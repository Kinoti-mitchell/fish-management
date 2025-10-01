-- Check Transfer Status and Inventory Movement
-- This will help diagnose why transfers aren't moving inventory

-- 1. Check recent transfers and their status
SELECT 
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
WHERE t.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY t.created_at DESC
LIMIT 10;

-- 2. Check if the approve_transfer function exists
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN ('approve_transfer', 'approve_batch_transfer')
AND routine_schema = 'public';

-- 3. Check if previous_storage_location_id column exists
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'sorting_results' 
AND column_name = 'previous_storage_location_id';

-- 4. Check recent inventory movements
SELECT 
    sr.id,
    sr.storage_location_id,
    sr.previous_storage_location_id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    sr.updated_at,
    sl.name as current_storage_name,
    sl_prev.name as previous_storage_name
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
LEFT JOIN storage_locations sl_prev ON sr.previous_storage_location_id = sl_prev.id
WHERE sr.updated_at >= NOW() - INTERVAL '1 hour'
ORDER BY sr.updated_at DESC
LIMIT 10;

-- 5. Check if there are any pending transfers
SELECT 
    COUNT(*) as pending_transfers_count
FROM transfers 
WHERE status = 'pending';

-- Success message
SELECT 'Transfer status check completed - review the results above' as status;
