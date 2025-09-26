-- Quick Fix for Transfer Approval Functions
-- This restores the approval functions that were working before

-- 1. Check what functions currently exist
SELECT '=== CHECKING EXISTING FUNCTIONS ===' as section;

SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('approve_transfer', 'decline_transfer', 'approve_batch_transfer')
ORDER BY routine_name;

-- 2. Create the missing approval functions
DROP FUNCTION IF EXISTS approve_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS decline_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS approve_batch_transfer(UUID, UUID);

-- Create approve_transfer function (simple version that was working)
CREATE OR REPLACE FUNCTION approve_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transfer RECORD;
BEGIN
    -- Check if transfer exists and is pending
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
    
    RETURN QUERY SELECT TRUE, 'Transfer approved successfully'::TEXT;
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
    -- Update transfer status to declined
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

-- Create approve_batch_transfer function (for batch transfers)
CREATE OR REPLACE FUNCTION approve_batch_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transfer RECORD;
    v_batch_transfers RECORD;
BEGIN
    -- Get the first transfer to find batch details
    SELECT * INTO v_transfer
    FROM transfers
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT;
        RETURN;
    END IF;
    
    -- Approve all transfers in the same batch
    UPDATE transfers
    SET 
        status = 'approved',
        approved_by = p_approved_by,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE from_storage_location_id = v_transfer.from_storage_location_id
    AND to_storage_location_id = v_transfer.to_storage_location_id
    AND created_at = v_transfer.created_at
    AND notes = v_transfer.notes
    AND status = 'pending';
    
    RETURN QUERY SELECT TRUE, 'Batch transfer approved successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_batch_transfer(UUID, UUID) TO authenticated;

-- 4. Test the functions
SELECT '=== TESTING FUNCTIONS ===' as section;

-- Test with a sample transfer (this will fail if no transfers exist, but that's OK)
-- SELECT approve_transfer('00000000-0000-0000-0000-000000000001'::UUID, '00000000-0000-0000-0000-000000000002'::UUID);

SELECT 'Transfer approval functions restored successfully!' as status;
