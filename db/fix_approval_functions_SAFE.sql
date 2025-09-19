-- SAFE Fix for Transfer Approval Functions
-- This version does NOT rely on unique constraints that may not exist

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS approve_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS decline_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS approve_batch_transfer(UUID, UUID);

-- Create approve_transfer function that actually moves inventory
CREATE OR REPLACE FUNCTION approve_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transfer RECORD;
    v_existing_record RECORD;
BEGIN
    SELECT * INTO v_transfer
    FROM transfers
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT;
        RETURN;
    END IF;
    
    -- Update transfer status to approved
    UPDATE transfers
    SET 
        status = 'approved',
        approved_by = p_approved_by,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id;
    
    -- Move inventory from source to destination storage
    -- First, reduce inventory in source storage
    UPDATE sorting_results
    SET 
        total_pieces = total_pieces - v_transfer.quantity,
        total_weight_grams = total_weight_grams - (v_transfer.weight_kg * 1000)::INTEGER
    WHERE storage_location_id = v_transfer.from_storage_location_id
    AND size_class = v_transfer.size_class
    AND total_pieces >= v_transfer.quantity;
    
    -- Check if the update was successful (inventory was sufficient)
    IF NOT FOUND THEN
        -- Rollback the transfer status
        UPDATE transfers
        SET 
            status = 'pending',
            approved_by = NULL,
            approved_at = NULL,
            updated_at = NOW()
        WHERE id = p_transfer_id;
        
        RETURN QUERY SELECT FALSE, 'Insufficient inventory in source storage'::TEXT;
        RETURN;
    END IF;
    
    -- Add inventory to destination storage
    -- Check if a record already exists for this storage_location_id and size_class
    SELECT * INTO v_existing_record
    FROM sorting_results
    WHERE storage_location_id = v_transfer.to_storage_location_id
    AND size_class = v_transfer.size_class
    LIMIT 1;
    
    IF FOUND THEN
        -- Update existing record
        UPDATE sorting_results
        SET 
            total_pieces = total_pieces + v_transfer.quantity,
            total_weight_grams = total_weight_grams + (v_transfer.weight_kg * 1000)::INTEGER,
            updated_at = NOW()
        WHERE storage_location_id = v_transfer.to_storage_location_id
        AND size_class = v_transfer.size_class;
    ELSE
        -- Insert new record
        INSERT INTO sorting_results (
            storage_location_id,
            size_class,
            total_pieces,
            total_weight_grams,
            created_at,
            updated_at
        ) VALUES (
            v_transfer.to_storage_location_id,
            v_transfer.size_class,
            v_transfer.quantity,
            (v_transfer.weight_kg * 1000)::INTEGER,
            NOW(),
            NOW()
        );
    END IF;
    
    -- Update storage capacities
    PERFORM update_storage_capacity_from_inventory();
    
    RETURN QUERY SELECT TRUE, 'Transfer approved and executed successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Create approve_batch_transfer function (same as approve_transfer for now)
CREATE OR REPLACE FUNCTION approve_batch_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
BEGIN
    -- For now, batch transfers work the same as single transfers
    RETURN QUERY SELECT * FROM approve_transfer(p_transfer_id, p_approved_by);
END;
$$ LANGUAGE plpgsql;

-- Create decline_transfer function
CREATE OR REPLACE FUNCTION decline_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
BEGIN
    UPDATE transfers
    SET 
        status = 'declined',
        approved_by = p_approved_by,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF FOUND THEN
        RETURN QUERY SELECT TRUE, 'Transfer declined successfully'::TEXT;
    ELSE
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_batch_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION approve_batch_transfer(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO anon;

-- Success message
SELECT 'SAFE Transfer approval functions created successfully!' as status;
