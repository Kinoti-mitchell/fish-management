-- Simple Transfer Function that Merges Fish by Size Class
-- This creates a clean transfer that adds fish to existing sizes

-- Step 1: Drop the existing transfer function
DROP FUNCTION IF EXISTS transfer_inventory_between_storage CASCADE;

-- Step 2: Create a simple transfer function that merges by size class
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
    v_source_weight_kg DECIMAL(10,2);
    v_destination_capacity_kg DECIMAL(10,2);
    v_destination_current_usage_kg DECIMAL(10,2);
    v_destination_available_kg DECIMAL(10,2);
    v_source_remaining INTEGER;
    v_destination_total INTEGER;
    v_size_record RECORD;
    v_new_batch_id UUID;
BEGIN
    -- Get total weight in source storage location
    SELECT COALESCE(SUM(sr.total_weight_grams) / 1000.0, 0)
    INTO v_source_weight_kg
    FROM sorting_results sr
    JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    WHERE sb.storage_location_id = p_from_storage_location_id 
    AND sb.status = 'completed';
    
    -- Get destination storage capacity and current usage
    SELECT 
        sl.capacity_kg,
        COALESCE(sl.current_usage_kg, 0)
    INTO v_destination_capacity_kg, v_destination_current_usage_kg
    FROM storage_locations sl
    WHERE sl.id = p_to_storage_location_id;
    
    -- Calculate available space in destination
    v_destination_available_kg := v_destination_capacity_kg - v_destination_current_usage_kg;
    
    -- Check if destination has enough space
    IF v_destination_available_kg < v_source_weight_kg THEN
        RETURN QUERY SELECT 
            FALSE, 
            'Insufficient space in destination storage location. Available: ' || v_destination_available_kg::TEXT || 'kg, Required: ' || v_source_weight_kg::TEXT || 'kg'::TEXT, 
            0, 
            0;
        RETURN;
    END IF;
    
    -- Create a new batch for the transfer
    v_new_batch_id := gen_random_uuid();
    
    -- Transfer each size class from source to destination
    FOR v_size_record IN 
        SELECT 
            sr.size_class,
            SUM(sr.total_pieces) as total_pieces,
            SUM(sr.total_weight_grams) as total_weight_grams
        FROM sorting_results sr
        JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
        WHERE sb.storage_location_id = p_from_storage_location_id 
        AND sb.status = 'completed'
        GROUP BY sr.size_class
    LOOP
        -- Add to destination storage for this size class
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
            v_size_record.size_class,
            v_size_record.total_pieces,
            v_size_record.total_weight_grams,
            v_new_batch_id,
            NOW(),
            NOW()
        );
        
        -- Create negative entry in source to remove from there
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
            v_size_record.size_class,
            -v_size_record.total_pieces,
            -v_size_record.total_weight_grams,
            v_new_batch_id,
            NOW(),
            NOW()
        );
    END LOOP;
    
    -- Update storage capacities
    PERFORM update_storage_capacity_from_inventory();
    
    -- Get remaining quantity in source (should be 0 after transfer)
    SELECT COALESCE(SUM(sr.total_pieces), 0)
    INTO v_source_remaining
    FROM sorting_results sr
    JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    WHERE sb.storage_location_id = p_from_storage_location_id 
    AND sb.status = 'completed';
    
    -- Get total quantity in destination
    SELECT COALESCE(SUM(sr.total_pieces), 0)
    INTO v_destination_total
    FROM sorting_results sr
    JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    WHERE sb.storage_location_id = p_to_storage_location_id 
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
        (v_source_weight_kg * 1000)::INTEGER,
        COALESCE(p_notes, 'Transfer between storage locations - merged by size class')
    );
    
    RETURN QUERY SELECT 
        TRUE, 
        'Transfer completed successfully. Fish merged by size class in destination.'::TEXT, 
        v_source_remaining, 
        v_destination_total;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION transfer_inventory_between_storage TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_inventory_between_storage TO anon;

-- Step 4: Update storage capacities
SELECT update_storage_capacity_from_inventory();
