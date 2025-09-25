-- Inventory System with Safe Orders and History
-- This creates the complete inventory management system as specified

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types for the inventory system
DO $$ BEGIN
    CREATE TYPE entry_type AS ENUM ('inbound', 'order_dispatch', 'adjustment', 'transfer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'dispatched', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Inventory Table - Tracks current total stock per size
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    size INTEGER NOT NULL UNIQUE CHECK (size >= 0 AND size <= 10),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Inventory Entries Table - Logs every stock movement
CREATE TABLE IF NOT EXISTS inventory_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    size INTEGER NOT NULL CHECK (size >= 0 AND size <= 10),
    quantity_change INTEGER NOT NULL, -- positive = stock in, negative = stock out
    entry_type entry_type NOT NULL,
    reference_id UUID, -- optional, links to an order id if applicable
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Orders Table - Stores outlet orders
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_name VARCHAR(200) NOT NULL,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status order_status DEFAULT 'pending',
    total_value DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Order Items Table - Stores sizes/quantities for each order
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    size INTEGER NOT NULL CHECK (size >= 0 AND size <= 10),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) DEFAULT 0,
    total_price DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_size ON inventory(size);
CREATE INDEX IF NOT EXISTS idx_inventory_entries_size ON inventory_entries(size);
CREATE INDEX IF NOT EXISTS idx_inventory_entries_created_at ON inventory_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_entries_type ON inventory_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_inventory_entries_reference ON inventory_entries(reference_id);
CREATE INDEX IF NOT EXISTS idx_orders_outlet_name ON orders(outlet_name);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_size ON order_items(size);

-- Create updated_at trigger for inventory and orders
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;
CREATE TRIGGER update_inventory_updated_at 
    BEFORE UPDATE ON inventory 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to add stock to inventory
CREATE OR REPLACE FUNCTION add_stock(
    p_size INTEGER,
    p_quantity INTEGER,
    p_entry_type entry_type DEFAULT 'inbound',
    p_reference_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    size INTEGER,
    quantity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_inventory_id UUID;
    v_inventory_size INTEGER;
    v_new_quantity INTEGER;
    v_created_at TIMESTAMP WITH TIME ZONE;
    v_updated_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Validate input
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be positive';
    END IF;
    
    IF p_size < 0 OR p_size > 10 THEN
        RAISE EXCEPTION 'Size must be between 0 and 10';
    END IF;
    
    -- Insert or update inventory
    INSERT INTO inventory (size, quantity)
    VALUES (p_size, p_quantity)
    ON CONFLICT (size) 
    DO UPDATE SET 
        quantity = inventory.quantity + p_quantity,
        updated_at = NOW()
    RETURNING inventory.id, inventory.size, inventory.quantity, inventory.created_at, inventory.updated_at
    INTO v_inventory_id, v_inventory_size, v_new_quantity, v_created_at, v_updated_at;
    
    -- Log the entry
    INSERT INTO inventory_entries (size, quantity_change, entry_type, reference_id, notes)
    VALUES (p_size, p_quantity, p_entry_type, p_reference_id, p_notes);
    
    -- Return the updated inventory row
    RETURN QUERY SELECT v_inventory_id, v_inventory_size, v_new_quantity, v_created_at, v_updated_at;
END;
$$ LANGUAGE plpgsql;

-- Function to safely dispatch an order
CREATE OR REPLACE FUNCTION dispatch_order(p_order_id UUID)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    inventory_updates JSONB,
    order_status order_status
) AS $$
DECLARE
    v_order_record RECORD;
    v_item_record RECORD;
    v_current_stock INTEGER;
    v_new_stock INTEGER;
    v_inventory_updates JSONB := '[]'::JSONB;
    v_all_sufficient BOOLEAN := TRUE;
    v_error_message TEXT := '';
BEGIN
    -- Get order details
    SELECT * INTO v_order_record FROM orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Order not found'::TEXT, '[]'::JSONB, 'failed'::order_status;
        RETURN;
    END IF;
    
    IF v_order_record.status != 'pending' THEN
        RETURN QUERY SELECT FALSE, 'Order is not pending'::TEXT, '[]'::JSONB, v_order_record.status;
        RETURN;
    END IF;
    
    -- Check stock availability for all items
    FOR v_item_record IN 
        SELECT * FROM order_items WHERE order_id = p_order_id
    LOOP
        -- Get current stock for this size
        SELECT COALESCE(quantity, 0) INTO v_current_stock 
        FROM inventory WHERE size = v_item_record.size;
        
        -- Check if sufficient stock
        IF v_current_stock < v_item_record.quantity THEN
            v_all_sufficient := FALSE;
            v_error_message := v_error_message || 'Insufficient stock for size ' || v_item_record.size || 
                             ' (requested: ' || v_item_record.quantity || ', available: ' || v_current_stock || '). ';
        END IF;
    END LOOP;
    
    -- If insufficient stock, mark order as failed
    IF NOT v_all_sufficient THEN
        UPDATE orders SET status = 'failed', updated_at = NOW() WHERE id = p_order_id;
        RETURN QUERY SELECT FALSE, v_error_message, '[]'::JSONB, 'failed'::order_status;
        RETURN;
    END IF;
    
    -- Process the dispatch - deduct stock and log entries
    FOR v_item_record IN 
        SELECT * FROM order_items WHERE order_id = p_order_id
    LOOP
        -- Deduct from inventory
        UPDATE inventory 
        SET quantity = quantity - v_item_record.quantity,
            updated_at = NOW()
        WHERE size = v_item_record.size
        RETURNING quantity INTO v_new_stock;
        
        -- Log the inventory entry
        INSERT INTO inventory_entries (size, quantity_change, entry_type, reference_id, notes)
        VALUES (v_item_record.size, -v_item_record.quantity, 'order_dispatch', p_order_id, 
                'Order dispatch for ' || v_order_record.outlet_name);
        
        -- Add to inventory updates array
        v_inventory_updates := v_inventory_updates || jsonb_build_object(
            'size', v_item_record.size,
            'quantity_deducted', v_item_record.quantity,
            'remaining_stock', v_new_stock
        );
    END LOOP;
    
    -- Update order status to dispatched
    UPDATE orders SET status = 'dispatched', updated_at = NOW() WHERE id = p_order_id;
    
    RETURN QUERY SELECT TRUE, 'Order dispatched successfully'::TEXT, v_inventory_updates, 'dispatched'::order_status;
END;
$$ LANGUAGE plpgsql;

-- Function to get current inventory totals
CREATE OR REPLACE FUNCTION get_inventory_totals()
RETURNS TABLE(
    size INTEGER,
    quantity INTEGER,
    last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY 
    SELECT i.size, i.quantity, i.updated_at
    FROM inventory i
    ORDER BY i.size;
END;
$$ LANGUAGE plpgsql;

-- Function to get inventory movement history
CREATE OR REPLACE FUNCTION get_inventory_history(
    p_size INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
    id UUID,
    size INTEGER,
    quantity_change INTEGER,
    entry_type entry_type,
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY 
    SELECT ie.id, ie.size, ie.quantity_change, ie.entry_type, ie.reference_id, ie.notes, ie.created_at
    FROM inventory_entries ie
    WHERE (p_size IS NULL OR ie.size = p_size)
    ORDER BY ie.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get order details with items
CREATE OR REPLACE FUNCTION get_order_details(p_order_id UUID)
RETURNS TABLE(
    order_id UUID,
    outlet_name VARCHAR(200),
    order_date TIMESTAMP WITH TIME ZONE,
    status order_status,
    total_value DECIMAL(12,2),
    notes TEXT,
    items JSONB
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        o.id,
        o.outlet_name,
        o.order_date,
        o.status,
        o.total_value,
        o.notes,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', oi.id,
                    'size', oi.size,
                    'quantity', oi.quantity,
                    'unit_price', oi.unit_price,
                    'total_price', oi.total_price
                )
            ) FILTER (WHERE oi.id IS NOT NULL),
            '[]'::JSONB
        ) as items
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE o.id = p_order_id
    GROUP BY o.id, o.outlet_name, o.order_date, o.status, o.total_value, o.notes;
END;
$$ LANGUAGE plpgsql;

-- Function to create a new order with items
CREATE OR REPLACE FUNCTION create_order(
    p_outlet_name VARCHAR(200),
    p_items JSONB, -- Array of {size: int, quantity: int, unit_price: decimal}
    p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
    order_id UUID,
    outlet_name VARCHAR(200),
    total_value DECIMAL(12,2),
    status order_status
) AS $$
DECLARE
    v_order_id UUID;
    v_item JSONB;
    v_total_value DECIMAL(12,2) := 0;
    v_item_total DECIMAL(12,2);
BEGIN
    -- Create the order
    INSERT INTO orders (outlet_name, notes)
    VALUES (p_outlet_name, p_notes)
    RETURNING id INTO v_order_id;
    
    -- Process each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_total := (v_item->>'quantity')::INTEGER * (v_item->>'unit_price')::DECIMAL(10,2);
        v_total_value := v_total_value + v_item_total;
        
        INSERT INTO order_items (order_id, size, quantity, unit_price, total_price)
        VALUES (
            v_order_id,
            (v_item->>'size')::INTEGER,
            (v_item->>'quantity')::INTEGER,
            (v_item->>'unit_price')::DECIMAL(10,2),
            v_item_total
        );
    END LOOP;
    
    -- Update order total value
    UPDATE orders SET total_value = v_total_value WHERE id = v_order_id;
    
    RETURN QUERY 
    SELECT v_order_id, p_outlet_name, v_total_value, 'pending'::order_status;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON inventory TO authenticated;
GRANT ALL ON inventory_entries TO authenticated;
GRANT ALL ON orders TO authenticated;
GRANT ALL ON order_items TO authenticated;
GRANT EXECUTE ON FUNCTION add_stock TO authenticated;
GRANT EXECUTE ON FUNCTION dispatch_order TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_totals TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_details TO authenticated;
GRANT EXECUTE ON FUNCTION create_order TO authenticated;

-- Insert some sample data for testing
INSERT INTO inventory (size, quantity) VALUES 
(1, 50),
(2, 75),
(3, 100),
(4, 60),
(5, 40)
ON CONFLICT (size) DO NOTHING;

-- Insert some sample inventory entries
INSERT INTO inventory_entries (size, quantity_change, entry_type, notes) VALUES 
(1, 50, 'inbound', 'Initial stock'),
(2, 75, 'inbound', 'Initial stock'),
(3, 100, 'inbound', 'Initial stock'),
(4, 60, 'inbound', 'Initial stock'),
(5, 40, 'inbound', 'Initial stock')
ON CONFLICT DO NOTHING;
