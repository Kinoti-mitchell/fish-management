-- Check pending transfers in your database
-- This will show you the exact data that's causing the "Pending Reviews: 2" count

-- 1. Count all pending transfers
SELECT 
    COUNT(*) as total_pending_transfers,
    'Total pending transfers in database' as description
FROM transfers 
WHERE status = 'pending';

-- 2. Show all pending transfers with details
SELECT 
    id,
    from_storage_name,
    to_storage_name,
    size_class,
    quantity,
    weight_kg,
    notes,
    status,
    created_at,
    requested_by,
    approved_by,
    approved_at,
    updated_at
FROM transfers 
WHERE status = 'pending'
ORDER BY created_at DESC;

-- 3. Show all transfer statuses and their counts
SELECT 
    status,
    COUNT(*) as count
FROM transfers 
GROUP BY status
ORDER BY status;

-- 4. Show recent transfers (last 10) regardless of status
SELECT 
    id,
    from_storage_name,
    to_storage_name,
    size_class,
    quantity,
    weight_kg,
    status,
    created_at,
    requested_by
FROM transfers 
ORDER BY created_at DESC
LIMIT 10;
