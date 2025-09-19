-- Working Transfer Function with Proper Movement
-- This actually moves fish from source to destination by updating storage_location_id

-- Step 1: Drop the existing transfer function
DROP FUNCTION IF EXISTS transfer_inventory_between_storage CASCADE;

-- Step 2: Create a working transfer function that actually moves fish
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
    v_updated_rows INTEGER;
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
    
    -- Actually move the fish by updating storage_location_id in sorting_results
    UPDATE sorting_results 
    SET 
        storage_location_id = p_to_storage_location_id,
        updated_at = NOW()
    WHERE storage_location_id = p_from_storage_location_id;
    
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
        'Transfer completed successfully. Moved ' || v_updated_rows::TEXT || ' records'::TEXT, 
        v_source_remaining, 
        v_destination_total;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create transfer approval table
CREATE TABLE IF NOT EXISTS transfer_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_storage_location_id UUID NOT NULL,
    to_storage_location_id UUID NOT NULL,
    size_class INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    weight_kg DECIMAL(10,2) NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    requested_by UUID,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create function to create transfer request
CREATE OR REPLACE FUNCTION create_transfer_request(
    p_from_storage_location_id UUID,
    p_to_storage_location_id UUID,
    p_size INTEGER,
    p_quantity INTEGER,
    p_weight_kg DECIMAL(10,2),
    p_notes TEXT DEFAULT NULL,
    p_requested_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_request_id UUID;
BEGIN
    INSERT INTO transfer_requests (
        from_storage_location_id,
        to_storage_location_id,
        size_class,
        quantity,
        weight_kg,
        notes,
        requested_by
    ) VALUES (
        p_from_storage_location_id,
        p_to_storage_location_id,
        p_size,
        p_quantity,
        p_weight_kg,
        p_notes,
        p_requested_by
    ) RETURNING id INTO v_request_id;
    
    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create function to approve transfer request
CREATE OR REPLACE FUNCTION approve_transfer_request(
    p_request_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_request RECORD;
    v_transfer_result RECORD;
BEGIN
    -- Get the transfer request
    SELECT * INTO v_request
    FROM transfer_requests
    WHERE id = p_request_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer request not found or already processed'::TEXT;
        RETURN;
    END IF;
    
    -- Execute the transfer
    SELECT * INTO v_transfer_result
    FROM transfer_inventory_between_storage(
        v_request.from_storage_location_id,
        v_request.to_storage_location_id,
        v_request.size_class,
        v_request.quantity,
        v_request.notes
    );
    
    -- Update request status
    UPDATE transfer_requests
    SET 
        status = CASE WHEN v_transfer_result.success THEN 'approved' ELSE 'declined' END,
        approved_by = p_approved_by,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id;
    
    RETURN QUERY SELECT v_transfer_result.success, v_transfer_result.message;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create function to decline transfer request
CREATE OR REPLACE FUNCTION decline_transfer_request(
    p_request_id UUID,
    p_approved_by UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE transfer_requests
    SET 
        status = 'declined',
        approved_by = p_approved_by,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id AND status = 'pending';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Grant permissions
GRANT EXECUTE ON FUNCTION transfer_inventory_between_storage TO authenticated;
GRANT EXECUTE ON FUNCTION create_transfer_request TO authenticated;
GRANT EXECUTE ON FUNCTION approve_transfer_request TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer_request TO authenticated;
GRANT ALL ON transfer_requests TO authenticated;
GRANT ALL ON transfer_log TO authenticated;

-- Step 8: Disable RLS on transfer tables
ALTER TABLE transfer_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_log DISABLE ROW LEVEL SECURITY;

-- Step 9: Update storage capacities
SELECT update_storage_capacity_from_inventory();
