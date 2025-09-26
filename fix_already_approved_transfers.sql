-- Fix Already Approved Transfers That Didn't Move Inventory
-- This script handles transfers that were approved but inventory wasn't moved

-- 1. Check what approved transfers exist that might need inventory movement
SELECT '=== CHECKING APPROVED TRANSFERS ===' as section;

SELECT 
    t.id,
    t.from_storage_name,
    t.to_storage_name,
    t.size_class,
    t.quantity,
    t.weight_kg,
    t.status,
    t.approved_at,
    t.created_at
FROM transfers t
WHERE t.status = 'approved'
ORDER BY t.approved_at DESC
LIMIT 10;

-- 2. Check if inventory was actually moved for these transfers
SELECT '=== CHECKING INVENTORY MOVEMENT ===' as section;

SELECT 
    t.id as transfer_id,
    t.from_storage_name,
    t.to_storage_name,
    t.size_class,
    t.status,
    -- Check source storage inventory
    (SELECT COUNT(*) FROM sorting_results sr 
     WHERE sr.storage_location_id = t.from_storage_location_id 
     AND sr.size_class = t.size_class) as source_inventory_count,
    -- Check destination storage inventory  
    (SELECT COUNT(*) FROM sorting_results sr 
     WHERE sr.storage_location_id = t.to_storage_location_id 
     AND sr.size_class = t.size_class) as destination_inventory_count
FROM transfers t
WHERE t.status = 'approved'
ORDER BY t.approved_at DESC
LIMIT 10;

-- 3. Create a function to fix already approved transfers
CREATE OR REPLACE FUNCTION fix_approved_transfers()
RETURNS TABLE(
    transfer_id UUID,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transfer RECORD;
    v_updated_rows INTEGER;
BEGIN
    -- Loop through all approved transfers
    FOR v_transfer IN 
        SELECT * FROM transfers 
        WHERE status = 'approved'
        ORDER BY approved_at DESC
    LOOP
        -- Try to move inventory for this transfer
        UPDATE sorting_results
        SET 
            storage_location_id = v_transfer.to_storage_location_id,
            updated_at = NOW()
        WHERE storage_location_id = v_transfer.from_storage_location_id
        AND size_class = v_transfer.size_class
        AND total_pieces >= v_transfer.quantity;
        
        -- Check if the update was successful
        GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
        
        IF v_updated_rows > 0 THEN
            -- Inventory was moved successfully
            RETURN QUERY SELECT v_transfer.id, TRUE, 
                'Inventory moved for transfer ' || v_transfer.id::TEXT || ' (' || v_updated_rows || ' records moved)'::TEXT;
        ELSE
            -- No inventory found to move
            RETURN QUERY SELECT v_transfer.id, FALSE, 
                'No inventory found to move for transfer ' || v_transfer.id::TEXT::TEXT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. Run the fix function
SELECT '=== FIXING APPROVED TRANSFERS ===' as section;

SELECT * FROM fix_approved_transfers();

-- 5. Check the results after fixing
SELECT '=== CHECKING RESULTS AFTER FIX ===' as section;

SELECT 
    t.id as transfer_id,
    t.from_storage_name,
    t.to_storage_name,
    t.size_class,
    t.status,
    t.approved_at,
    -- Check source storage inventory after fix
    (SELECT COUNT(*) FROM sorting_results sr 
     WHERE sr.storage_location_id = t.from_storage_location_id 
     AND sr.size_class = t.size_class) as source_inventory_after,
    -- Check destination storage inventory after fix
    (SELECT COUNT(*) FROM sorting_results sr 
     WHERE sr.storage_location_id = t.to_storage_location_id 
     AND sr.size_class = t.size_class) as destination_inventory_after
FROM transfers t
WHERE t.status = 'approved'
ORDER BY t.approved_at DESC
LIMIT 10;

-- 6. Clean up the temporary function
DROP FUNCTION IF EXISTS fix_approved_transfers();

SELECT 'Approved transfers fix completed!' as status;
