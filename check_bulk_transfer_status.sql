-- CHECK BULK TRANSFER STATUS
-- This will show us the actual status of all transfers in the bulk batch

SELECT '=== ALL TRANSFERS IN BULK BATCH ===' as section;
SELECT 
    id,
    from_storage_name,
    to_storage_name,
    size_class,
    weight_kg,
    quantity,
    status,
    approved_by,
    approved_at,
    completed_at,
    created_at
FROM transfers 
WHERE 
    from_storage_name = 'Cold Storage A'
    AND to_storage_name = 'storage 1'
    AND notes = 'Transfer from Cold Storage A - Sizes: 10, 3, 5, 9 - No notes'
    AND created_at = '2025-09-18 13:05:14.045467+00'
ORDER BY size_class;

SELECT '=== BULK TRANSFER SUMMARY ===' as section;
SELECT 
    COUNT(*) as total_transfers,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
    COUNT(CASE WHEN status = 'declined' THEN 1 END) as declined_count
FROM transfers 
WHERE 
    from_storage_name = 'Cold Storage A'
    AND to_storage_name = 'storage 1'
    AND notes = 'Transfer from Cold Storage A - Sizes: 10, 3, 5, 9 - No notes'
    AND created_at = '2025-09-18 13:05:14.045467+00';

-- Check if any transfers are still pending
SELECT '=== PENDING TRANSFERS ===' as section;
SELECT 
    id,
    size_class,
    status,
    approved_by,
    approved_at
FROM transfers 
WHERE 
    from_storage_name = 'Cold Storage A'
    AND to_storage_name = 'storage 1'
    AND notes = 'Transfer from Cold Storage A - Sizes: 10, 3, 5, 9 - No notes'
    AND created_at = '2025-09-18 13:05:14.045467+00'
    AND status = 'pending';
