-- Fix Transfer Approval System
-- This script creates the missing approval functions that the frontend needs

-- 1. First, let's check what functions currently exist
SELECT '=== CHECKING EXISTING APPROVAL FUNCTIONS ===' as section;

SELECT 
    routine_name,
    routine_type,
    data_type,
    parameter_name,
    parameter_mode,
    data_type as parameter_type
FROM information_schema.routines r
LEFT JOIN information_schema.parameters p ON r.specific_name = p.specific_name
WHERE r.routine_schema = 'public' 
AND r.routine_name IN ('approve_transfer', 'decline_transfer', 'approve_batch_transfer')
ORDER BY r.routine_name, p.ordinal_position;

-- 2. Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS approve_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS decline_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS approve_batch_transfer(UUID, UUID);

-- 3. Create approve_transfer function (simple version - just updates status)
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
    -- Get the transfer record
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

-- 4. Create decline_transfer function
CREATE OR REPLACE FUNCTION decline_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transfer RECORD;
BEGIN
    -- Get the transfer record
    SELECT * INTO v_transfer
    FROM transfers
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT;
        RETURN;
    END IF;
    
    -- Update transfer status to declined
    UPDATE transfers
    SET 
        status = 'declined',
        approved_by = p_approved_by,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id;
    
    RETURN QUERY SELECT TRUE, 'Transfer declined successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 5. Create approve_batch_transfer function (for batch transfers)
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
    v_approved_count INTEGER := 0;
BEGIN
    -- Get the first transfer to identify the batch
    SELECT * INTO v_transfer
    FROM transfers
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT;
        RETURN;
    END IF;
    
    -- Find all transfers in the same batch (same from/to storage, same timestamp, same notes)
    FOR v_batch_transfers IN 
        SELECT * FROM transfers
        WHERE from_storage_location_id = v_transfer.from_storage_location_id
        AND to_storage_location_id = v_transfer.to_storage_location_id
        AND created_at = v_transfer.created_at
        AND notes = v_transfer.notes
        AND status = 'pending'
    LOOP
        -- Update each transfer in the batch
        UPDATE transfers
        SET 
            status = 'approved',
            approved_by = p_approved_by,
            approved_at = NOW(),
            updated_at = NOW()
        WHERE id = v_batch_transfers.id;
        
        v_approved_count := v_approved_count + 1;
    END LOOP;
    
    RETURN QUERY SELECT TRUE, ('Batch transfer approved successfully - ' || v_approved_count || ' transfers processed')::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 6. Grant permissions on all functions
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_batch_transfer(UUID, UUID) TO authenticated;

-- 7. Test the functions with sample data
SELECT '=== TESTING APPROVAL FUNCTIONS ===' as section;

-- Check if there are any pending transfers to test with
SELECT 
    'Pending Transfers' as info,
    id,
    from_storage_name,
    to_storage_name,
    size_class,
    weight_kg,
    status,
    created_at
FROM transfers
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 5;

-- 8. Create a simple test (commented out to avoid affecting real data)
-- SELECT approve_transfer(
--     '00000000-0000-0000-0000-000000000001'::UUID,
--     '00000000-0000-0000-0000-000000000002'::UUID
-- ) as test_result;

-- 9. Check the transfers table structure to ensure all required columns exist
SELECT '=== CHECKING TRANSFERS TABLE STRUCTURE ===' as section;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'transfers' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 10. Ensure the transfers table has all required columns
ALTER TABLE transfers 
ADD COLUMN IF NOT EXISTS approved_by UUID,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 11. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transfers_approved_by ON transfers(approved_by);
CREATE INDEX IF NOT EXISTS idx_transfers_approved_at ON transfers(approved_at);
CREATE INDEX IF NOT EXISTS idx_transfers_updated_at ON transfers(updated_at);

SELECT 'Transfer approval system setup completed successfully!' as status;
SELECT 'Functions created: approve_transfer, decline_transfer, approve_batch_transfer' as functions_created;
