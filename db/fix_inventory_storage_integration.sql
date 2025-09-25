-- Fix Inventory System with Proper Storage Location Integration
-- This implements the correct logic: Storage → Sizes within Storage → Add to existing size if same storage and size

-- Step 1: Check current inventory system structure
SELECT 
    'Current inventory system analysis:' as analysis,
    COUNT(*) as total_inventory_records,
    COUNT(DISTINCT size) as unique_sizes,
    SUM(quantity) as total_quantity
FROM inventory;

-- Step 2: Check storage locations
SELECT 
    'Storage locations analysis:' as analysis,
    COUNT(*) as total_storage_locations,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_locations,
    SUM(capacity_kg) as total_capacity_kg,
    SUM(current_usage_kg) as total_current_usage_kg
FROM storage_locations;

-- Step 3: Create new inventory table with storage location integration
-- This replaces the current simple inventory table
CREATE TABLE IF NOT EXISTS inventory_with_storage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    storage_location_id UUID NOT NULL REFERENCES storage_locations(id),
    size INTEGER NOT NULL CHECK (size >= 0 AND size <= 10),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    total_weight_kg DECIMAL(10,2) DEFAULT 0.00,
    average_weight_per_fish DECIMAL(6,3) DEFAULT 0.000,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique combination of storage location and size
    UNIQUE(storage_location_id, size)
);

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_storage_location ON inventory_with_storage(storage_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_storage_size ON inventory_with_storage(size);
CREATE INDEX IF NOT EXISTS idx_inventory_storage_location_size ON inventory_with_storage(storage_location_id, size);
CREATE INDEX IF NOT EXISTS idx_inventory_storage_updated ON inventory_with_storage(last_updated DESC);

-- Step 5: Create updated inventory entries table with storage location
CREATE TABLE IF NOT EXISTS inventory_entries_with_storage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    storage_location_id UUID NOT NULL REFERENCES storage_locations(id),
    size INTEGER NOT NULL CHECK (size >= 0 AND size <= 10),
    quantity_change INTEGER NOT NULL, -- positive = stock in, negative = stock out
    entry_type TEXT NOT NULL CHECK (entry_type IN ('sorting', 'order_dispatch', 'adjustment', 'transfer', 'processing')),
    reference_id UUID, -- links to sorting_batches.id, orders.id, etc.
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 6: Create indexes for inventory entries
CREATE INDEX IF NOT EXISTS idx_inventory_entries_storage_location ON inventory_entries_with_storage(storage_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_entries_size ON inventory_entries_with_storage(size);
CREATE INDEX IF NOT EXISTS idx_inventory_entries_created_at ON inventory_entries_with_storage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_entries_type ON inventory_entries_with_storage(entry_type);
CREATE INDEX IF NOT EXISTS idx_inventory_entries_reference ON inventory_entries_with_storage(reference_id);

-- Step 7: Create function to add stock from sorting batch with storage location
CREATE OR REPLACE FUNCTION add_stock_from_sorting_with_storage(
    p_sorting_batch_id UUID,
    p_storage_location_id UUID
) RETURNS TABLE(
    id UUID,
    storage_location_id UUID,
    size INTEGER,
    quantity INTEGER,
    total_weight_kg DECIMAL(10,2),
    last_updated TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_sorting_batch RECORD;
    v_size_key TEXT;
    v_quantity INTEGER;
    v_inventory_size INTEGER;
    v_weight_kg DECIMAL(10,2);
    v_inventory_id UUID;
    v_storage_location_id UUID;
    v_new_quantity INTEGER;
    v_new_total_weight DECIMAL(10,2);
    v_updated_at TIMESTAMP WITH TIME ZONE;
    v_total_added INTEGER := 0;
BEGIN
    -- Get the sorting batch
    SELECT * INTO v_sorting_batch 
    FROM sorting_batches 
    WHERE id = p_sorting_batch_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sorting batch not found';
    END IF;
    
    IF v_sorting_batch.status != 'completed' THEN
        RAISE EXCEPTION 'Sorting batch is not completed';
    END IF;
    
    -- Check if this sorting batch has already been added to inventory
    IF EXISTS (
        SELECT 1 FROM inventory_entries_with_storage 
        WHERE reference_id = p_sorting_batch_id 
        AND entry_type = 'sorting'
    ) THEN
        RAISE EXCEPTION 'This sorting batch has already been added to inventory';
    END IF;
    
    -- Process each size in the size_distribution
    FOR v_size_key, v_quantity IN 
        SELECT key, value::INTEGER 
        FROM jsonb_each_text(v_sorting_batch.size_distribution)
        WHERE value::INTEGER > 0
    LOOP
        -- Convert size key to integer
        v_inventory_size := v_size_key::INTEGER;
        
        -- Validate size
        IF v_inventory_size < 0 OR v_inventory_size > 10 THEN
            CONTINUE; -- Skip invalid sizes
        END IF;
        
        -- Calculate weight for this size (estimate based on average weight per size)
        v_weight_kg := v_quantity * CASE v_inventory_size
            WHEN 0 THEN 0.2  -- Small fish
            WHEN 1 THEN 0.3
            WHEN 2 THEN 0.4
            WHEN 3 THEN 0.5
            WHEN 4 THEN 0.6
            WHEN 5 THEN 0.7
            WHEN 6 THEN 0.8
            WHEN 7 THEN 0.9
            WHEN 8 THEN 1.0
            WHEN 9 THEN 1.1
            WHEN 10 THEN 1.2  -- Large fish
            ELSE 0.5
        END;
        
        -- Insert or update inventory with storage location
        INSERT INTO inventory_with_storage (storage_location_id, size, quantity, total_weight_kg, average_weight_per_fish)
        VALUES (p_storage_location_id, v_inventory_size, v_quantity, v_weight_kg, v_weight_kg / v_quantity)
        ON CONFLICT (storage_location_id, size) 
        DO UPDATE SET 
            quantity = inventory_with_storage.quantity + v_quantity,
            total_weight_kg = inventory_with_storage.total_weight_kg + v_weight_kg,
            average_weight_per_fish = (inventory_with_storage.total_weight_kg + v_weight_kg) / (inventory_with_storage.quantity + v_quantity),
            last_updated = NOW(),
            updated_at = NOW()
        RETURNING inventory_with_storage.id, inventory_with_storage.storage_location_id, inventory_with_storage.size, 
                  inventory_with_storage.quantity, inventory_with_storage.total_weight_kg, inventory_with_storage.last_updated
        INTO v_inventory_id, v_storage_location_id, v_inventory_size, v_new_quantity, v_new_total_weight, v_updated_at;
        
        -- Log the entry
        INSERT INTO inventory_entries_with_storage (storage_location_id, size, quantity_change, entry_type, reference_id, notes)
        VALUES (p_storage_location_id, v_inventory_size, v_quantity, 'sorting', p_sorting_batch_id, 
                'From sorting batch - ' || v_sorting_batch.batch_number);
        
        v_total_added := v_total_added + v_quantity;
    END LOOP;
    
    -- Update storage location usage
    UPDATE storage_locations 
    SET current_usage_kg = current_usage_kg + (v_total_added * 0.5), -- Estimate weight
        updated_at = NOW()
    WHERE id = p_storage_location_id;
    
    -- Return the updated inventory records
    RETURN QUERY 
    SELECT i.id, i.storage_location_id, i.size, i.quantity, i.total_weight_kg, i.last_updated
    FROM inventory_with_storage i
    WHERE i.storage_location_id = p_storage_location_id
    AND i.quantity > 0
    ORDER BY i.size;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create function to get inventory by storage location
CREATE OR REPLACE FUNCTION get_inventory_by_storage_location(p_storage_location_id UUID DEFAULT NULL)
RETURNS TABLE(
    storage_location_id UUID,
    storage_location_name TEXT,
    size INTEGER,
    quantity INTEGER,
    total_weight_kg DECIMAL(10,2),
    average_weight_per_fish DECIMAL(6,3),
    last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        i.storage_location_id,
        sl.name as storage_location_name,
        i.size,
        i.quantity,
        i.total_weight_kg,
        i.average_weight_per_fish,
        i.last_updated
    FROM inventory_with_storage i
    JOIN storage_locations sl ON i.storage_location_id = sl.id
    WHERE (p_storage_location_id IS NULL OR i.storage_location_id = p_storage_location_id)
    AND i.quantity > 0
    ORDER BY sl.name, i.size;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create function to get inventory summary across all storage locations
CREATE OR REPLACE FUNCTION get_inventory_summary_with_storage()
RETURNS TABLE(
    storage_location_id UUID,
    storage_location_name TEXT,
    total_quantity INTEGER,
    total_weight_kg DECIMAL(10,2),
    size_distribution JSONB,
    capacity_kg DECIMAL(10,2),
    current_usage_kg DECIMAL(10,2),
    utilization_percent DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        sl.id as storage_location_id,
        sl.name as storage_location_name,
        COALESCE(SUM(i.quantity), 0) as total_quantity,
        COALESCE(SUM(i.total_weight_kg), 0) as total_weight_kg,
        COALESCE(
            jsonb_object_agg(
                i.size::TEXT, 
                jsonb_build_object(
                    'quantity', i.quantity,
                    'weight_kg', i.total_weight_kg,
                    'avg_weight_per_fish', i.average_weight_per_fish
                )
            ) FILTER (WHERE i.size IS NOT NULL),
            '{}'::JSONB
        ) as size_distribution,
        sl.capacity_kg,
        sl.current_usage_kg,
        CASE 
            WHEN sl.capacity_kg > 0 THEN ROUND((sl.current_usage_kg / sl.capacity_kg) * 100, 2)
            ELSE 0
        END as utilization_percent
    FROM storage_locations sl
    LEFT JOIN inventory_with_storage i ON sl.id = i.storage_location_id AND i.quantity > 0
    WHERE sl.status = 'active'
    GROUP BY sl.id, sl.name, sl.capacity_kg, sl.current_usage_kg
    ORDER BY sl.name;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Create function to transfer inventory between storage locations
CREATE OR REPLACE FUNCTION transfer_inventory_between_storage(
    p_from_storage_location_id UUID,
    p_to_storage_location_id UUID,
    p_size INTEGER,
    p_quantity INTEGER,
    p_notes TEXT DEFAULT NULL
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    from_remaining INTEGER,
    to_new_total INTEGER
) AS $$
DECLARE
    v_current_quantity INTEGER;
    v_from_remaining INTEGER;
    v_to_new_total INTEGER;
BEGIN
    -- Check if source has enough quantity
    SELECT quantity INTO v_current_quantity
    FROM inventory_with_storage
    WHERE storage_location_id = p_from_storage_location_id AND size = p_size;
    
    IF v_current_quantity IS NULL OR v_current_quantity < p_quantity THEN
        RETURN QUERY SELECT FALSE, 'Insufficient quantity in source storage location'::TEXT, 0, 0;
        RETURN;
    END IF;
    
    -- Deduct from source
    UPDATE inventory_with_storage 
    SET quantity = quantity - p_quantity,
        total_weight_kg = total_weight_kg - (p_quantity * average_weight_per_fish),
        last_updated = NOW(),
        updated_at = NOW()
    WHERE storage_location_id = p_from_storage_location_id AND size = p_size
    RETURNING quantity INTO v_from_remaining;
    
    -- Add to destination (or create new record)
    INSERT INTO inventory_with_storage (storage_location_id, size, quantity, total_weight_kg, average_weight_per_fish)
    SELECT p_to_storage_location_id, p_size, p_quantity, p_quantity * i.average_weight_per_fish, i.average_weight_per_fish
    FROM inventory_with_storage i
    WHERE i.storage_location_id = p_from_storage_location_id AND i.size = p_size
    ON CONFLICT (storage_location_id, size) 
    DO UPDATE SET 
        quantity = inventory_with_storage.quantity + p_quantity,
        total_weight_kg = inventory_with_storage.total_weight_kg + (p_quantity * EXCLUDED.average_weight_per_fish),
        average_weight_per_fish = (inventory_with_storage.total_weight_kg + (p_quantity * EXCLUDED.average_weight_per_fish)) / (inventory_with_storage.quantity + p_quantity),
        last_updated = NOW(),
        updated_at = NOW()
    RETURNING quantity INTO v_to_new_total;
    
    -- Log the transfer
    INSERT INTO inventory_entries_with_storage (storage_location_id, size, quantity_change, entry_type, reference_id, notes)
    VALUES 
        (p_from_storage_location_id, p_size, -p_quantity, 'transfer', NULL, 'Transfer out - ' || COALESCE(p_notes, 'No notes')),
        (p_to_storage_location_id, p_size, p_quantity, 'transfer', NULL, 'Transfer in - ' || COALESCE(p_notes, 'No notes'));
    
    RETURN QUERY SELECT TRUE, 'Transfer completed successfully'::TEXT, v_from_remaining, v_to_new_total;
END;
$$ LANGUAGE plpgsql;

-- Step 11: Create trigger to update storage location usage when inventory changes
CREATE OR REPLACE FUNCTION update_storage_location_usage()
RETURNS TRIGGER AS $$
DECLARE
    v_weight_change DECIMAL(10,2);
BEGIN
    -- Calculate weight change
    IF TG_OP = 'INSERT' THEN
        v_weight_change := NEW.total_weight_kg;
    ELSIF TG_OP = 'UPDATE' THEN
        v_weight_change := NEW.total_weight_kg - OLD.total_weight_kg;
    ELSIF TG_OP = 'DELETE' THEN
        v_weight_change := -OLD.total_weight_kg;
    END IF;
    
    -- Update storage location usage
    UPDATE storage_locations 
    SET current_usage_kg = current_usage_kg + v_weight_change,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.storage_location_id, OLD.storage_location_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_storage_location_usage ON inventory_with_storage;
CREATE TRIGGER trigger_update_storage_location_usage
    AFTER INSERT OR UPDATE OR DELETE ON inventory_with_storage
    FOR EACH ROW
    EXECUTE FUNCTION update_storage_location_usage();

-- Step 12: Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON inventory_with_storage TO authenticated;
GRANT ALL ON inventory_entries_with_storage TO authenticated;
GRANT EXECUTE ON FUNCTION add_stock_from_sorting_with_storage TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_by_storage_location TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_summary_with_storage TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_inventory_between_storage TO authenticated;

-- Step 13: Migrate existing inventory data (if any)
-- This will move data from the old inventory table to the new storage-based system
INSERT INTO inventory_with_storage (storage_location_id, size, quantity, total_weight_kg, average_weight_per_fish)
SELECT 
    (SELECT id FROM storage_locations WHERE status = 'active' LIMIT 1) as storage_location_id,
    i.size,
    i.quantity,
    i.quantity * 0.5 as total_weight_kg, -- Estimate weight
    0.5 as average_weight_per_fish
FROM inventory i
WHERE i.quantity > 0
ON CONFLICT (storage_location_id, size) 
DO UPDATE SET 
    quantity = inventory_with_storage.quantity + EXCLUDED.quantity,
    total_weight_kg = inventory_with_storage.total_weight_kg + EXCLUDED.total_weight_kg,
    last_updated = NOW(),
    updated_at = NOW();

-- Step 14: Show results
SELECT 
    'Inventory system with storage integration completed!' as status,
    COUNT(*) as total_storage_locations,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_storage_locations,
    (SELECT COUNT(*) FROM inventory_with_storage) as inventory_records_created,
    (SELECT SUM(quantity) FROM inventory_with_storage) as total_fish_in_inventory
FROM storage_locations;

-- Step 15: Show sample inventory by storage location
SELECT 
    'Sample inventory by storage location:' as sample,
    sl.name as storage_location,
    i.size,
    i.quantity,
    i.total_weight_kg,
    i.average_weight_per_fish
FROM inventory_with_storage i
JOIN storage_locations sl ON i.storage_location_id = sl.id
WHERE i.quantity > 0
ORDER BY sl.name, i.size
LIMIT 10;
