-- Fix Transfer Approval with Inventory Movement
-- This script creates the approve_transfer function that actually moves inventory between storage locations

-- 1. Drop existing approve_transfer function to avoid conflicts
DROP FUNCTION IF EXISTS approve_transfer(UUID, UUID) CASCADE;

-- 2. Create approve_transfer function that moves inventory
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
    
    -- Move inventory from source to destination storage
    -- This updates the storage_location_id in sorting_results to move the inventory
    UPDATE sorting_results
    SET 
        storage_location_id = v_transfer.to_storage_location_id,
        updated_at = NOW()
    WHERE storage_location_id = v_transfer.from_storage_location_id
    AND size_class = v_transfer.size_class
    AND total_pieces >= v_transfer.quantity;
    
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

-- 4. Grant permissions on the functions
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO authenticated;

-- 5. Test the functions exist
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name IN ('approve_transfer', 'decline_transfer')
AND routine_schema = 'public';

-- 6. Success message
SELECT 'Transfer approval functions created with inventory movement!' as status;
