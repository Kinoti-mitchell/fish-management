-- Create the missing decline_batch_transfer function
-- This function handles declining all transfers in a batch

CREATE OR REPLACE FUNCTION decline_batch_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transfer RECORD;
    v_batch_key TEXT;
    v_total_count INTEGER;
    v_declined_count INTEGER := 0;
    v_current_transfer RECORD;
BEGIN
    -- Get the transfer record
    SELECT * INTO v_transfer
    FROM transfers
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT;
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
        RETURN QUERY SELECT TRUE, format('Batch transfer declined successfully. %s transfers declined.', v_declined_count)::TEXT;
    ELSE
        RETURN QUERY SELECT FALSE, 'No transfers were declined'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION decline_batch_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_batch_transfer(UUID, UUID) TO anon;

-- Success message
SELECT 'decline_batch_transfer function created successfully!' as status;
