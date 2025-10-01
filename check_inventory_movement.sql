-- Check if Inventory is Actually Moving After Transfer Approval
-- This will help verify if the transfer system is working

-- 1. Check recent transfers and their status
SELECT 
    'Recent Transfers' as check_type,
    t.id,
    t.status,
    t.from_storage_name,
    t.to_storage_name,
    t.size_class,
    t.quantity,
    t.weight_kg,
    t.approved_at,
    t.approved_by
FROM transfers t
WHERE t.created_at >= NOW() - INTERVAL '2 hours'
ORDER BY t.created_at DESC
LIMIT 5;

-- 2. Check if inventory has moved (look for records with previous_storage_location_id)
SELECT 
    'Inventory Movement Check' as check_type,
    sr.id,
    sr.storage_location_id as current_storage_id,
    sr.previous_storage_location_id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    sr.updated_at,
    sl_current.name as current_storage_name,
    sl_previous.name as previous_storage_name
FROM sorting_results sr
LEFT JOIN storage_locations sl_current ON sr.storage_location_id = sl_current.id
LEFT JOIN storage_locations sl_previous ON sr.previous_storage_location_id = sl_previous.id
WHERE sr.previous_storage_location_id IS NOT NULL
AND sr.updated_at >= NOW() - INTERVAL '2 hours'
ORDER BY sr.updated_at DESC
LIMIT 10;

-- 3. Check if the approve_transfer function exists and is working
SELECT 
    'Function Check' as check_type,
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN ('approve_transfer', 'approve_batch_transfer')
AND routine_schema = 'public';

-- 4. Check if previous_storage_location_id column exists
SELECT 
    'Column Check' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'sorting_results' 
AND column_name = 'previous_storage_location_id';

-- 5. Check for any pending transfers that should have been processed
SELECT 
    'Pending Transfers' as check_type,
    COUNT(*) as pending_count
FROM transfers 
WHERE status = 'pending'
AND created_at >= NOW() - INTERVAL '2 hours';

-- 6. Check storage capacity updates
SELECT 
    'Storage Capacity Check' as check_type,
    sl.id,
    sl.name,
    sl.current_usage_kg,
    sl.updated_at
FROM storage_locations sl
WHERE sl.updated_at >= NOW() - INTERVAL '2 hours'
ORDER BY sl.updated_at DESC
LIMIT 5;

-- Success message
SELECT 'Inventory movement check completed - review results above' as status;
