-- FIX TRANSFER APPROVAL - Use Logged In User
-- This script fixes the foreign key constraint issue by using a valid user ID

-- ==============================================
-- 1. GET A VALID USER ID
-- ==============================================

SELECT '=== GETTING VALID USER ID ===' as section;
SELECT id as user_id, email FROM users LIMIT 1;

-- ==============================================
-- 2. TEST APPROVAL WITH VALID USER
-- ==============================================

-- Test approval using the first available user
DO $$
DECLARE
    v_user_id UUID;
    v_result RECORD;
BEGIN
    -- Get the first available user ID from the users table (not auth.users)
    SELECT id INTO v_user_id FROM users LIMIT 1;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No valid user found to approve transfer';
    END IF;
    
    RAISE NOTICE 'Using user ID: % for approval', v_user_id;
    
    -- Test the approval
    SELECT * INTO v_result FROM approve_transfer('47803438-31e9-48f0-b9e4-810791cab244', v_user_id);
    
    RAISE NOTICE 'Approval result: success=%, message=%', v_result.success, v_result.message;
END $$;

-- ==============================================
-- 3. CHECK RESULTS
-- ==============================================

SELECT '=== TRANSFER STATUS AFTER APPROVAL ===' as section;
SELECT 
    id,
    size_class,
    weight_kg,
    quantity,
    status,
    approved_by,
    approved_at,
    completed_at
FROM transfers 
WHERE 
    from_storage_name = 'Cold Storage A'
    AND to_storage_name = 'storage 1'
    AND notes = 'Transfer from Cold Storage A - Sizes: 10, 3, 5, 9 - No notes'
ORDER BY size_class;

SELECT '=== INVENTORY STATUS AFTER APPROVAL ===' as section;
SELECT 
    sr.storage_location_id,
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    (sr.total_weight_grams / 1000.0) as weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sr.storage_location_id IN (
    SELECT DISTINCT from_storage_location_id FROM transfers WHERE from_storage_name = 'Cold Storage A'
    UNION
    SELECT DISTINCT to_storage_location_id FROM transfers WHERE to_storage_name = 'storage 1'
)
AND sr.size_class IN (3, 5, 9, 10)
ORDER BY sr.storage_location_id, sr.size_class;
