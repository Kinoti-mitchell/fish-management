-- Inventory System Integrated with Processing Data
-- This version integrates with the existing processing_records table

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types for the inventory system
DO $$ BEGIN
    CREATE TYPE entry_type AS ENUM ('processing', 'order_dispatch', 'adjustment', 'transfer');
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
    reference_id UUID, -- links to processing_records.id or orders.id
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

-- Function to add stock from processing records
CREATE OR REPLACE FUNCTION add_stock_from_processing(p_processing_record_id UUID)
RETURNS TABLE(
    id UUID,
    size INTEGER,
    quantity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_processing_record RECORD;
    v_size_key TEXT;
    v_quantity INTEGER;
    v_inventory_id UUID;
    v_inventory_size INTEGER;
    v_new_quantity INTEGER;
    v_created_at TIMESTAMP WITH TIME ZONE;
    v_updated_at TIMESTAMP WITH TIME ZONE;
    v_total_added INTEGER := 0;
BEGIN
    -- Get the processing record
    SELECT * INTO v_processing_record 
    FROM processing_records 
    WHERE id = p_processing_record_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Processing record not found';
    END IF;
    
    -- Check if this processing record has already been added to inventory
    IF EXISTS (
        SELECT 1 FROM inventory_entries 
        WHERE reference_id = p_processing_record_id 
        AND entry_type = 'processing'
    ) THEN
        RAISE EXCEPTION 'This processing record has already been added to inventory';
    END IF;
    
    -- Process each size in the size_distribution
    FOR v_size_key, v_quantity IN 
        SELECT key, value::INTEGER 
        FROM jsonb_each_text(v_processing_record.size_distribution)
        WHERE value::INTEGER > 0
    LOOP
        -- Convert size key to integer
        v_inventory_size := v_size_key::INTEGER;
        
        -- Validate size
        IF v_inventory_size < 0 OR v_inventory_size > 10 THEN
            CONTINUE; -- Skip invalid sizes
        END IF;
        
        -- Insert or update inventory
        INSERT INTO inventory (size, quantity)
        VALUES (v_inventory_size, v_quantity)
        ON CONFLICT (size) 
        DO UPDATE SET 
            quantity = inventory.quantity + v_quantity,
            updated_at = NOW()
        RETURNING inventory.id, inventory.size, inventory.quantity, inventory.created_at, inventory.updated_at
        INTO v_inventory_id, v_inventory_size, v_new_quantity, v_created_at, v_updated_at;
        
        -- Log the entry
        INSERT INTO inventory_entries (size, quantity_change, entry_type, reference_id, notes)
        VALUES (v_inventory_size, v_quantity, 'processing', p_processing_record_id, 
                'From processing record - ' || v_processing_record.processing_date::TEXT);
        
        v_total_added := v_total_added + v_quantity;
    END LOOP;
    
    -- Return the first updated inventory row (or create a summary)
    IF v_total_added > 0 THEN
        RETURN QUERY 
        SELECT v_inventory_id, v_inventory_size, v_new_quantity, v_created_at, v_updated_at;
    ELSE
        RAISE EXCEPTION 'No valid sizes found in processing record';
    END IF;
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

-- Function to get processing records ready for inventory
CREATE OR REPLACE FUNCTION get_processing_records_for_inventory()
RETURNS TABLE(
    id UUID,
    processing_date DATE,
    size_distribution JSONB,
    ready_for_dispatch_count INTEGER,
    already_added BOOLEAN
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        pr.id,
        pr.processing_date,
        pr.size_distribution,
        pr.ready_for_dispatch_count,
        EXISTS(
            SELECT 1 FROM inventory_entries ie 
            WHERE ie.reference_id = pr.id 
            AND ie.entry_type = 'processing'
        ) as already_added
    FROM processing_records pr
    WHERE pr.ready_for_dispatch_count > 0
    ORDER BY pr.processing_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get inventory summary with processing data
CREATE OR REPLACE FUNCTION get_inventory_summary()
RETURNS TABLE(
    size INTEGER,
    current_stock INTEGER,
    total_processed INTEGER,
    total_dispatched INTEGER,
    pending_orders INTEGER
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        COALESCE(i.size, s.size) as size,
        COALESCE(i.quantity, 0) as current_stock,
        COALESCE(SUM(CASE WHEN ie.entry_type = 'processing' THEN ie.quantity_change ELSE 0 END), 0) as total_processed,
        COALESCE(SUM(CASE WHEN ie.entry_type = 'order_dispatch' THEN ABS(ie.quantity_change) ELSE 0 END), 0) as total_dispatched,
        COALESCE(SUM(oi.quantity), 0) as pending_orders
    FROM (
        SELECT DISTINCT size FROM inventory
        UNION
        SELECT DISTINCT size FROM inventory_entries
        UNION
        SELECT DISTINCT size FROM order_items
    ) s
    LEFT JOIN inventory i ON s.size = i.size
    LEFT JOIN inventory_entries ie ON s.size = ie.size
    LEFT JOIN order_items oi ON s.size = oi.size
    LEFT JOIN orders o ON oi.order_id = o.id AND o.status = 'pending'
    GROUP BY s.size, i.quantity
    ORDER BY s.size;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON inventory TO authenticated;
GRANT ALL ON inventory_entries TO authenticated;
GRANT ALL ON orders TO authenticated;
GRANT ALL ON order_items TO authenticated;
GRANT EXECUTE ON FUNCTION add_stock_from_processing TO authenticated;
GRANT EXECUTE ON FUNCTION dispatch_order TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_totals TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_details TO authenticated;
GRANT EXECUTE ON FUNCTION create_order TO authenticated;
GRANT EXECUTE ON FUNCTION get_processing_records_for_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_summary TO authenticated;

-- Insert some sample data for testing (if no processing records exist)
INSERT INTO inventory (size, quantity) VALUES 
(1, 0),
(2, 0),
(3, 0),
(4, 0),
(5, 0)
ON CONFLICT (size) DO NOTHING;
