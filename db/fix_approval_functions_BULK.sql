-- BULK Fix for Transfer Approval Functions
-- This version properly handles bulk transfers by approving all individual transfers in the batch

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS approve_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS decline_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS approve_batch_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS complete_transfer(UUID, UUID);

-- Create approve_transfer function that handles both single and bulk transfers
CREATE OR REPLACE FUNCTION approve_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    moved_records JSONB
) AS $$
DECLARE
    v_transfer RECORD;
    v_moved_records JSONB[] := '{}';
    v_updated_rows INTEGER;
    v_moved_record RECORD;
    v_batch_key TEXT;
    v_success_count INTEGER := 0;
    v_total_count INTEGER := 0;
    v_current_transfer RECORD;
BEGIN
    -- Get the transfer record
    SELECT * INTO v_transfer
    FROM transfers
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT, NULL::JSONB;
        RETURN;
    END IF;
    
    -- Create batch key to find all related transfers
    v_batch_key := v_transfer.from_storage_location_id || '-' || 
                   v_transfer.to_storage_location_id || '-' || 
                   v_transfer.created_at || '-' || 
                   COALESCE(v_transfer.notes, '');
    
    -- Count total transfers in this batch
    SELECT COUNT(*) INTO v_total_count
    FROM transfers t
    WHERE t.from_storage_location_id = v_transfer.from_storage_location_id
    AND t.to_storage_location_id = v_transfer.to_storage_location_id
    AND t.created_at = v_transfer.created_at
    AND COALESCE(t.notes, '') = COALESCE(v_transfer.notes, '')
    AND t.status = 'pending';
    
    -- Process each transfer in the batch using a cursor
    FOR v_current_transfer IN 
        SELECT * FROM transfers t
        WHERE t.from_storage_location_id = v_transfer.from_storage_location_id
        AND t.to_storage_location_id = v_transfer.to_storage_location_id
        AND t.created_at = v_transfer.created_at
        AND COALESCE(t.notes, '') = COALESCE(v_transfer.notes, '')
        AND t.status = 'pending'
    LOOP
        -- Update transfer status to approved
        UPDATE transfers
        SET 
            status = 'approved',
            approved_by = p_approved_by,
            approved_at = NOW(),
            updated_at = NOW()
        WHERE id = v_current_transfer.id;
        
        -- Move inventory by changing storage_location_id AND record transfer history
        UPDATE sorting_results
        SET 
            storage_location_id = v_current_transfer.to_storage_location_id,
            -- Record transfer history for reporting purposes
            transfer_source_storage_id = COALESCE(transfer_source_storage_id, v_current_transfer.from_storage_location_id),
            transfer_source_storage_name = COALESCE(transfer_source_storage_name, v_current_transfer.from_storage_name),
            transfer_id = COALESCE(transfer_id, v_current_transfer.id),
            updated_at = NOW()
        WHERE storage_location_id = v_current_transfer.from_storage_location_id
        AND size_class = v_current_transfer.size_class
        AND total_pieces >= v_current_transfer.quantity
        RETURNING * INTO v_moved_record;
        
        GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
        
        IF v_updated_rows > 0 THEN
            -- Successfully moved this transfer
            v_success_count := v_success_count + 1;
            v_moved_records := v_moved_records || to_jsonb(v_moved_record);
            
            -- Mark this transfer as completed
            UPDATE transfers
            SET 
                status = 'completed',
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = v_current_transfer.id;
        ELSE
            -- Failed to move this transfer - rollback its status
            UPDATE transfers
            SET 
                status = 'pending',
                approved_by = NULL,
                approved_at = NULL,
                updated_at = NOW()
            WHERE id = v_current_transfer.id;
        END IF;
    END LOOP;
    
    -- Update storage capacities
    PERFORM update_storage_capacity_from_inventory();
    
    -- Return result based on success count
    IF v_success_count = 0 THEN
        RETURN QUERY SELECT FALSE, 'No inventory could be moved for any transfers in the batch'::TEXT, NULL::JSONB;
    ELSIF v_success_count = v_total_count THEN
        RETURN QUERY SELECT TRUE, 
            format('All %s transfers in batch approved and completed successfully', v_total_count)::TEXT,
            to_jsonb(v_moved_records);
    ELSE
        RETURN QUERY SELECT TRUE, 
            format('%s of %s transfers in batch completed successfully', v_success_count, v_total_count)::TEXT,
            to_jsonb(v_moved_records);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create approve_batch_transfer function (same as approve_transfer for now)
CREATE OR REPLACE FUNCTION approve_batch_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    moved_records JSONB
) AS $$
BEGIN
    -- For now, batch transfers work the same as single transfers
    RETURN QUERY SELECT * FROM approve_transfer(p_transfer_id, p_approved_by);
END;
$$ LANGUAGE plpgsql;

-- Create decline_transfer function that also handles bulk transfers
CREATE OR REPLACE FUNCTION decline_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    moved_records JSONB
) AS $$
DECLARE
    v_transfer RECORD;
    v_batch_key TEXT;
    v_total_count INTEGER := 0;
    v_declined_count INTEGER := 0;
    v_current_transfer RECORD;
BEGIN
    -- Get the transfer record
    SELECT * INTO v_transfer
    FROM transfers
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT, NULL::JSONB;
        RETURN;
    END IF;
    
    -- Create batch key to find all related transfers
    v_batch_key := v_transfer.from_storage_location_id || '-' || 
                   v_transfer.to_storage_location_id || '-' || 
                   v_transfer.created_at || '-' || 
                   COALESCE(v_transfer.notes, '');
    
    -- Count total transfers in this batch
    SELECT COUNT(*) INTO v_total_count
    FROM transfers t
    WHERE t.from_storage_location_id = v_transfer.from_storage_location_id
    AND t.to_storage_location_id = v_transfer.to_storage_location_id
    AND t.created_at = v_transfer.created_at
    AND COALESCE(t.notes, '') = COALESCE(v_transfer.notes, '')
    AND t.status = 'pending';
    
    -- Decline all transfers in the batch using a cursor
    FOR v_current_transfer IN 
        SELECT * FROM transfers t
        WHERE t.from_storage_location_id = v_transfer.from_storage_location_id
        AND t.to_storage_location_id = v_transfer.to_storage_location_id
        AND t.created_at = v_transfer.created_at
        AND COALESCE(t.notes, '') = COALESCE(v_transfer.notes, '')
        AND t.status = 'pending'
    LOOP
        UPDATE transfers
        SET 
            status = 'declined',
            approved_by = p_approved_by,
            approved_at = NOW(),
            updated_at = NOW()
        WHERE id = v_current_transfer.id;
        
        v_declined_count := v_declined_count + 1;
    END LOOP;
    
    IF v_declined_count > 0 THEN
        RETURN QUERY SELECT TRUE, 
            format('All %s transfers in batch declined successfully', v_declined_count)::TEXT,
            NULL::JSONB;
    ELSE
        RETURN QUERY SELECT FALSE, 'No transfers could be declined'::TEXT, NULL::JSONB;
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
    moved_records JSONB
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
SELECT 'BULK Transfer approval functions created successfully!' as status;
