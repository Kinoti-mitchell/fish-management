-- Simple Transfer Fix - Works with Current Data Structure
-- This creates a transfer system that works by creating new sorting_results records

-- Step 1: Drop the problematic transfer function
DROP FUNCTION IF EXISTS transfer_inventory_between_storage CASCADE;

-- Step 2: Create a simple transfer function that works with sorting_results
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
    v_source_weight_grams INTEGER;
    v_weight_per_fish DECIMAL(10,2);
    v_transfer_weight_grams INTEGER;
    v_destination_quantity INTEGER;
    v_source_batch_id UUID;
BEGIN
    -- Get source quantity and weight from sorting_results
    SELECT 
        COALESCE(SUM(sr.total_pieces), 0),
        COALESCE(SUM(sr.total_weight_grams), 0),
        MAX(sr.sorting_batch_id)
    INTO v_source_quantity, v_source_weight_grams, v_source_batch_id
    FROM sorting_results sr
    LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    WHERE sr.storage_location_id = p_from_storage_location_id 
    AND sr.size_class = p_size
    AND COALESCE(sb.status, 'completed') = 'completed';
    
    -- Check if source has enough quantity
    IF v_source_quantity < p_quantity THEN
        RETURN QUERY SELECT FALSE, 'Insufficient quantity in source storage location'::TEXT, v_source_quantity, 0;
        RETURN;
    END IF;
    
    -- Calculate weight per fish
    v_weight_per_fish := CASE 
        WHEN v_source_quantity > 0 THEN v_source_weight_grams::DECIMAL / v_source_quantity
        ELSE 0
    END;
    
    v_transfer_weight_grams := (p_quantity * v_weight_per_fish)::INTEGER;
    
    -- Create new sorting_results record in destination storage
    INSERT INTO sorting_results (
        storage_location_id,
        size_class,
        total_pieces,
        total_weight_grams,
        sorting_batch_id,
        created_at,
        updated_at
    ) VALUES (
        p_to_storage_location_id,
        p_size,
        p_quantity,
        v_transfer_weight_grams,
        v_source_batch_id,
        NOW(),
        NOW()
    );
    
    -- Create a "transfer out" record in source storage (negative quantity)
    INSERT INTO sorting_results (
        storage_location_id,
        size_class,
        total_pieces,
        total_weight_grams,
        sorting_batch_id,
        created_at,
        updated_at
    ) VALUES (
        p_from_storage_location_id,
        p_size,
        -p_quantity,
        -v_transfer_weight_grams,
        v_source_batch_id,
        NOW(),
        NOW()
    );
    
    -- Get remaining quantity in source
    SELECT COALESCE(SUM(sr.total_pieces), 0)
    INTO v_source_quantity
    FROM sorting_results sr
    LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    WHERE sr.storage_location_id = p_from_storage_location_id 
    AND sr.size_class = p_size
    AND COALESCE(sb.status, 'completed') = 'completed';
    
    -- Get total quantity in destination
    SELECT COALESCE(SUM(sr.total_pieces), 0)
    INTO v_destination_quantity
    FROM sorting_results sr
    LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    WHERE sr.storage_location_id = p_to_storage_location_id 
    AND sr.size_class = p_size
    AND COALESCE(sb.status, 'completed') = 'completed';
    
    -- Create transfer log entry
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
        v_transfer_weight_grams,
        COALESCE(p_notes, 'Transfer between storage locations')
    );
    
    RETURN QUERY SELECT TRUE, 'Transfer completed successfully'::TEXT, v_source_quantity, v_destination_quantity;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create function to get transfer history
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

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION transfer_inventory_between_storage TO authenticated;
GRANT EXECUTE ON FUNCTION get_transfer_history TO authenticated;
GRANT ALL ON transfer_log TO authenticated;

-- Step 5: Update storage capacities
SELECT update_storage_capacity_from_inventory();
