-- HISTORY Fix for Transfer Approval Functions
-- This version maintains history by using transfer tracking columns

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS approve_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS decline_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS approve_batch_transfer(UUID, UUID);

-- Create approve_transfer function that maintains transfer history
CREATE OR REPLACE FUNCTION approve_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    moved_record JSONB
) AS $$
DECLARE
    v_transfer RECORD;
    v_updated_rows INTEGER;
    v_moved_record RECORD;
BEGIN
    SELECT * INTO v_transfer
    FROM transfers
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT, NULL::JSONB;
        RETURN;
    END IF;
    
    -- Update transfer status to approved first
    UPDATE transfers
    SET 
        status = 'approved',
        approved_by = p_approved_by,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id;
    
    -- Move inventory by changing storage_location_id AND record transfer history
    -- This moves the existing record from source to destination storage
    -- while preserving the original source information for reporting
    UPDATE sorting_results
    SET 
        storage_location_id = v_transfer.to_storage_location_id,
        -- Record transfer history for reporting purposes
        transfer_source_storage_id = COALESCE(transfer_source_storage_id, v_transfer.from_storage_location_id),
        transfer_source_storage_name = COALESCE(transfer_source_storage_name, v_transfer.from_storage_name),
        transfer_id = COALESCE(transfer_id, p_transfer_id),
        updated_at = NOW()
    WHERE storage_location_id = v_transfer.from_storage_location_id
    AND size_class = v_transfer.size_class
    AND total_pieces >= v_transfer.quantity
    RETURNING * INTO v_moved_record;
    
    -- Check if the update was successful (inventory was found and moved)
    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    
    IF v_updated_rows = 0 THEN
        -- No inventory found to move - rollback the transfer status
        UPDATE transfers
        SET 
            status = 'pending',
            approved_by = NULL,
            approved_at = NULL,
            updated_at = NOW()
        WHERE id = p_transfer_id;
        
        RETURN QUERY SELECT FALSE, 'No inventory found in source storage to transfer'::TEXT, NULL::JSONB;
        RETURN;
    END IF;
    
    -- Update storage capacities
    PERFORM update_storage_capacity_from_inventory();
    
    -- Mark transfer as completed after successful inventory movement
    UPDATE transfers
    SET 
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id;
    
    RETURN QUERY SELECT TRUE, 'Transfer approved, inventory moved, and marked as completed'::TEXT, to_jsonb(v_moved_record);
END;
$$ LANGUAGE plpgsql;

-- Create approve_batch_transfer function (same as approve_transfer for now)
CREATE OR REPLACE FUNCTION approve_batch_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    moved_record JSONB
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
    message TEXT,
    moved_record JSONB
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
        RETURN QUERY SELECT TRUE, 'Transfer declined successfully'::TEXT, NULL::JSONB;
    ELSE
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT, NULL::JSONB;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create complete_transfer function (for manual completion if needed)
CREATE OR REPLACE FUNCTION complete_transfer(
    p_transfer_id UUID,
    p_completed_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    moved_record JSONB
) AS $$
BEGIN
    UPDATE transfers
    SET 
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id AND status IN ('approved', 'pending');
    
    IF FOUND THEN
        RETURN QUERY SELECT TRUE, 'Transfer marked as completed successfully'::TEXT, NULL::JSONB;
    ELSE
        RETURN QUERY SELECT FALSE, 'Transfer not found or already completed/declined'::TEXT, NULL::JSONB;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_batch_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION approve_batch_transfer(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION complete_transfer(UUID, UUID) TO anon;

-- Success message
SELECT 'HISTORY Transfer approval functions created successfully!' as status;
