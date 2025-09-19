-- Reset denied transfers back to pending status so they can be approved again
-- This will reset the transfers for User f5946671 from 18/09/2025

-- First, let's see what denied transfers we have
SELECT 
    t.id,
    t.from_storage_location_id,
    t.to_storage_location_id,
    t.size_class,
    t.quantity,
    t.weight_kg,
    t.status,
    t.notes,
    t.created_at,
    sl_from.name as from_storage_name,
    sl_to.name as to_storage_name
FROM transfers t
LEFT JOIN storage_locations sl_from ON t.from_storage_location_id = sl_from.id
LEFT JOIN storage_locations sl_to ON t.to_storage_location_id = sl_to.id
WHERE t.notes LIKE '%Transfer from Cold Storage B - Sizes: 1, 2, 4%'
AND t.created_at::date = '2025-09-18'
AND t.status = 'denied'
ORDER BY t.size_class, t.created_at;

-- Reset the denied transfers back to pending status
UPDATE transfers 
SET 
    status = 'pending',
    approved_by = NULL,
    approved_at = NULL,
    updated_at = NOW()
WHERE notes LIKE '%Transfer from Cold Storage B - Sizes: 1, 2, 4%'
AND created_at::date = '2025-09-18'
AND status = 'denied';

-- Show the updated status
SELECT 
    'UPDATED TRANSFERS' as status,
    COUNT(*) as count,
    'transfers reset to pending' as message
FROM transfers 
WHERE notes LIKE '%Transfer from Cold Storage B - Sizes: 1, 2, 4%'
AND created_at::date = '2025-09-18'
AND status = 'pending';

-- Show final status of all related transfers
SELECT 
    t.id,
    t.size_class,
    t.quantity,
    t.weight_kg,
    t.status,
    t.notes,
    sl_from.name as from_storage_name,
    sl_to.name as to_storage_name
FROM transfers t
LEFT JOIN storage_locations sl_from ON t.from_storage_location_id = sl_from.id
LEFT JOIN storage_locations sl_to ON t.to_storage_location_id = sl_to.id
WHERE t.notes LIKE '%Transfer from Cold Storage B - Sizes: 1, 2, 4%'
AND t.created_at::date = '2025-09-18'
ORDER BY t.size_class, t.created_at;
