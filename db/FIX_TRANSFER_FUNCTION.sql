-- Fix Transfer Function to Work with Current Data Structure
-- This script creates a transfer function that works with sorting_results table

-- Step 1: Create a corrected transfer function that works with sorting_results
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
    v_weight_per_fish DECIMAL(10,2);
    v_total_weight_grams INTEGER;
    v_transfer_weight_grams INTEGER;
BEGIN
    -- Check if source has enough quantity by calculating from sorting_results
    SELECT 
        COALESCE(SUM(sr.total_pieces), 0),
        COALESCE(SUM(sr.total_weight_grams), 0)
    INTO v_current_quantity, v_total_weight_grams
    FROM sorting_results sr
    LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    WHERE sr.storage_location_id = p_from_storage_location_id 
    AND sr.size_class = p_size
    AND COALESCE(sb.status, 'completed') = 'completed';
    
    IF v_current_quantity IS NULL OR v_current_quantity < p_quantity THEN
        RETURN QUERY SELECT FALSE, 'Insufficient quantity in source storage location'::TEXT, 0, 0;
        RETURN;
    END IF;
    
    -- Calculate weight per fish for transfer
    v_weight_per_fish := CASE 
        WHEN v_current_quantity > 0 THEN v_total_weight_grams::DECIMAL / v_current_quantity
        ELSE 0
    END;
    
    v_transfer_weight_grams := (p_quantity * v_weight_per_fish)::INTEGER;
    
    -- Update sorting_results to move from source to destination
    -- First, update existing records in source storage to reduce quantity
    UPDATE sorting_results 
    SET 
        total_pieces = total_pieces - p_quantity,
        total_weight_grams = total_weight_grams - v_transfer_weight_grams,
        updated_at = NOW()
    WHERE storage_location_id = p_from_storage_location_id 
    AND size_class = p_size
    AND total_pieces >= p_quantity
    LIMIT 1;
    
    -- Get remaining quantity in source
    SELECT COALESCE(SUM(sr.total_pieces), 0)
    INTO v_from_remaining
    FROM sorting_results sr
    LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    WHERE sr.storage_location_id = p_from_storage_location_id 
    AND sr.size_class = p_size
    AND COALESCE(sb.status, 'completed') = 'completed';
    
    -- Create new record in destination storage
    INSERT INTO sorting_results (
        storage_location_id,
        size_class,
        total_pieces,
        total_weight_grams,
        sorting_batch_id,
        created_at,
        updated_at
    )
    SELECT 
        p_to_storage_location_id,
        p_size,
        p_quantity,
        v_transfer_weight_grams,
        sr.sorting_batch_id,
        NOW(),
        NOW()
    FROM sorting_results sr
    WHERE sr.storage_location_id = p_from_storage_location_id 
    AND sr.size_class = p_size
    LIMIT 1;
    
    -- Get new total in destination
    SELECT COALESCE(SUM(sr.total_pieces), 0)
    INTO v_to_new_total
    FROM sorting_results sr
    LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    WHERE sr.storage_location_id = p_to_storage_location_id 
    AND sr.size_class = p_size
    AND COALESCE(sb.status, 'completed') = 'completed';
    
    -- Log the transfer in a simple transfer log table (create if not exists)
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
    
    -- Update storage location usage
    UPDATE storage_locations 
    SET 
        current_usage_kg = (
            SELECT COALESCE(SUM(sr.total_weight_grams) / 1000.0, 0)
            FROM sorting_results sr
            LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
            WHERE sr.storage_location_id = storage_locations.id
            AND COALESCE(sb.status, 'completed') = 'completed'
        ),
        updated_at = NOW()
    WHERE id IN (p_from_storage_location_id, p_to_storage_location_id);
    
    RETURN QUERY SELECT TRUE, 'Transfer completed successfully'::TEXT, v_from_remaining, v_to_new_total;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create a function to get transfer history from transfer_log
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
        sl_from.name as from_storage_name,
        sl_to.name as to_storage_name,
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

-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION transfer_inventory_between_storage TO authenticated;
GRANT EXECUTE ON FUNCTION get_transfer_history TO authenticated;
GRANT ALL ON transfer_log TO authenticated;

-- Step 4: Update storage capacities
SELECT update_storage_capacity_from_inventory();
