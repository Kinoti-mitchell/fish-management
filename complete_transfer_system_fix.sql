-- Complete Transfer System Fix
-- This script fixes everything to make transfers actually work

-- 1. First, let's see what we have
SELECT 'CURRENT STATE:' as status;
SELECT 
    id,
    from_storage_name,
    to_storage_name,
    size_class,
    quantity,
    weight_kg,
    status
FROM transfers 
WHERE status = 'pending'
ORDER BY created_at DESC;

-- 2. Drop and recreate the approve_transfer function that actually works
DROP FUNCTION IF EXISTS approve_transfer(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION approve_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transfer RECORD;
    v_updated_rows INTEGER;
    v_from_storage_name TEXT;
    v_to_storage_name TEXT;
BEGIN
    -- Get the transfer record
    SELECT * INTO v_transfer
    FROM transfers
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT;
        RETURN;
    END IF;
    
    -- Get storage names
    SELECT name INTO v_from_storage_name FROM storage_locations WHERE id = v_transfer.from_storage_location_id;
    SELECT name INTO v_to_storage_name FROM storage_locations WHERE id = v_transfer.to_storage_location_id;
    
    -- Update transfer status to approved
    UPDATE transfers
    SET 
        status = 'approved',
        approved_by = p_approved_by,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id;
    
    -- Move inventory from source to destination storage
    -- This is the key part - we update the storage_location_id AND set transfer tracking info
    UPDATE sorting_results
    SET 
        storage_location_id = v_transfer.to_storage_location_id,
        transfer_id = p_transfer_id,
        transfer_source_storage_id = v_transfer.from_storage_location_id,
        transfer_source_storage_name = v_from_storage_name,
        updated_at = NOW()
    WHERE storage_location_id = v_transfer.from_storage_location_id
    AND size_class = v_transfer.size_class
    AND total_pieces >= v_transfer.quantity;
    
    -- Check if the update was successful
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
        
        RETURN QUERY SELECT FALSE, 'No inventory found to move for this transfer'::TEXT;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT TRUE, 'Transfer approved and inventory moved successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 3. Create decline_transfer function
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

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO authenticated;

-- 5. Test the functions exist
SELECT 'FUNCTIONS CREATED:' as status;
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name IN ('approve_transfer', 'decline_transfer')
AND routine_schema = 'public';

-- 6. Show what should happen after approval
SELECT 'AFTER APPROVAL - Check this query to see transferred inventory:' as instruction;
SELECT 'SELECT sl.name as storage, sr.size_class, sr.total_pieces, ROUND(sr.total_weight_grams/1000.0,2) as weight_kg, sr.transfer_source_storage_name FROM sorting_results sr JOIN storage_locations sl ON sr.storage_location_id = sl.id WHERE sr.transfer_id IS NOT NULL;' as query_to_run;
