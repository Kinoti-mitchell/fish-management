-- Complete Transfer Fix - One Script
-- This script fixes the approval function and moves inventory for already approved transfers

-- 1. Fix the approval function to actually move inventory
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
    
    -- Move inventory by changing storage_location_id in sorting_results
    UPDATE sorting_results
    SET 
        storage_location_id = v_transfer.to_storage_location_id,
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

-- 2. Create decline_transfer function
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

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO authenticated;

-- 4. Fix already approved transfers by moving their inventory
-- Move Size 1 inventory from Processing Area 2 to Cold Storage B
UPDATE sorting_results 
SET 
    storage_location_id = (SELECT id FROM storage_locations WHERE name = 'Cold Storage B'),
    updated_at = NOW()
WHERE storage_location_id = (SELECT id FROM storage_locations WHERE name = 'Processing Area 2')
AND size_class = 1;

-- 5. Check results
SELECT 'Processing Area 2 - Size 1 After Fix' as check_type;
SELECT 
    sr.id,
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Processing Area 2' AND sr.size_class = 1;

SELECT 'Cold Storage B - Size 1 After Fix' as check_type;
SELECT 
    sr.id,
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Cold Storage B' AND sr.size_class = 1;

-- 6. Final storage summary
SELECT 'Final Storage Summary' as check_type;
SELECT 
    sl.name as storage_name,
    sl.location_type,
    COUNT(*) as inventory_records,
    SUM(sr.total_pieces) as total_pieces,
    ROUND(SUM(sr.total_weight_grams) / 1000.0, 2) as total_weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
GROUP BY sl.id, sl.name, sl.location_type
ORDER BY total_weight_kg DESC;

SELECT 'Transfer system fixed and inventory moved successfully!' as status;