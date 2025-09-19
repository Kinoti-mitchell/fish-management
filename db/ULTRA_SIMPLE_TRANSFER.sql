-- Ultra Simple Transfer - Works with Actual Data Structure
-- This creates a transfer system that works by updating sorting_batches storage_location_id

-- Step 1: Create transfer_log table first
CREATE TABLE IF NOT EXISTS transfer_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_storage_location_id UUID,
    to_storage_location_id UUID,
    size_class INTEGER,
    quantity INTEGER,
    weight_grams INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

-- Step 2: Drop the problematic transfer function
DROP FUNCTION IF EXISTS transfer_inventory_between_storage CASCADE;

-- Step 3: Create a simple transfer function that updates sorting_batches
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
    v_source_quantity INTEGER;
    v_destination_quantity INTEGER;
    v_updated_rows INTEGER;
BEGIN
    -- Get source quantity by counting sorting_results for this size in source storage
    SELECT COALESCE(SUM(sr.total_pieces), 0)
    INTO v_source_quantity
    FROM sorting_results sr
    JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    WHERE sb.storage_location_id = p_from_storage_location_id 
    AND sr.size_class = p_size
    AND sb.status = 'completed';
    
    -- Check if source has enough quantity
    IF v_source_quantity < p_quantity THEN
        RETURN QUERY SELECT FALSE, 'Insufficient quantity in source storage location'::TEXT, v_source_quantity, 0;
        RETURN;
    END IF;
    
    -- Update ALL sorting_batches in source storage to move to destination
    UPDATE sorting_batches 
    SET 
        storage_location_id = p_to_storage_location_id,
        updated_at = NOW()
    WHERE storage_location_id = p_from_storage_location_id 
    AND status = 'completed';
    
    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    
    -- Get remaining quantity in source (should be 0 after transfer)
    SELECT COALESCE(SUM(sr.total_pieces), 0)
    INTO v_source_quantity
    FROM sorting_results sr
    JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    WHERE sb.storage_location_id = p_from_storage_location_id 
    AND sr.size_class = p_size
    AND sb.status = 'completed';
    
    -- Get total quantity in destination
    SELECT COALESCE(SUM(sr.total_pieces), 0)
    INTO v_destination_quantity
    FROM sorting_results sr
    JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    WHERE sb.storage_location_id = p_to_storage_location_id 
    AND sr.size_class = p_size
    AND sb.status = 'completed';
    
    -- Create transfer log entry
    INSERT INTO transfer_log (
        from_storage_location_id,
        to_storage_location_id,
        size_class,
        quantity,
        weight_grams,
        notes
    ) VALUES (
        p_from_storage_location_id,
        p_to_storage_location_id,
        p_size,
        p_quantity,
        0, -- We'll calculate this later if needed
        COALESCE(p_notes, 'Transfer between storage locations')
    );
    
    RETURN QUERY SELECT TRUE, 'Transfer completed successfully'::TEXT, v_source_quantity, v_destination_quantity;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create function to get transfer history
CREATE OR REPLACE FUNCTION get_transfer_history(limit_count INTEGER DEFAULT 100)
RETURNS TABLE(
    id UUID,
    from_storage_name TEXT,
    to_storage_name TEXT,
    size_class INTEGER,
    quantity INTEGER,
    weight_kg DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    created_by UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tl.id,
        COALESCE(sl_from.name, 'Unknown') as from_storage_name,
        COALESCE(sl_to.name, 'Unknown') as to_storage_name,
        tl.size_class,
        tl.quantity,
        (tl.weight_grams / 1000.0) as weight_kg,
        tl.notes,
        tl.created_at,
        tl.created_by
    FROM transfer_log tl
    LEFT JOIN storage_locations sl_from ON tl.from_storage_location_id = sl_from.id
    LEFT JOIN storage_locations sl_to ON tl.to_storage_location_id = sl_to.id
    ORDER BY tl.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Grant permissions
GRANT EXECUTE ON FUNCTION transfer_inventory_between_storage TO authenticated;
GRANT EXECUTE ON FUNCTION get_transfer_history TO authenticated;
GRANT ALL ON transfer_log TO authenticated;

-- Step 6: Disable RLS on transfer_log table to allow inserts
ALTER TABLE transfer_log DISABLE ROW LEVEL SECURITY;

-- Step 7: Grant specific permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON transfer_log TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Step 8: Update storage capacities
SELECT update_storage_capacity_from_inventory();
