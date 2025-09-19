-- Fix Transfer Function to Move Inventory Based on Space Only
-- This removes quantity validation and allows transfers as long as destination has space

-- Step 1: Drop the existing transfer function
DROP FUNCTION IF EXISTS transfer_inventory_between_storage CASCADE;

-- Step 2: Create a new transfer function that only checks destination space
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
    v_updated_rows INTEGER;
    v_source_remaining INTEGER;
    v_destination_total INTEGER;
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
    
    -- Move ALL sorting batches from source to destination
    UPDATE sorting_batches 
    SET 
        storage_location_id = p_to_storage_location_id,
        updated_at = NOW()
    WHERE storage_location_id = p_from_storage_location_id 
    AND status = 'completed';
    
    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    
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
        COALESCE(p_notes, 'Transfer between storage locations')
    );
    
    RETURN QUERY SELECT 
        TRUE, 
        'Transfer completed successfully. Moved ' || v_updated_rows::TEXT || ' batches'::TEXT, 
        v_source_remaining, 
        v_destination_total;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION transfer_inventory_between_storage TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_inventory_between_storage TO anon;

-- Step 4: Update storage capacities
SELECT update_storage_capacity_from_inventory();
