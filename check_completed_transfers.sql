-- Check completed transfers in your database
-- This will show you the completed transfers data

-- 1. Count all completed transfers
SELECT 
    COUNT(*) as total_completed_transfers,
    'Total completed transfers in database' as description
FROM transfers 
WHERE status = 'completed';

-- 2. Show all completed transfers with details
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
    completed_at,
    updated_at
FROM transfers 
WHERE status = 'completed'
ORDER BY created_at DESC;

-- 3. Show all transfer statuses and their counts
SELECT 
    status,
    COUNT(*) as count
FROM transfers 
GROUP BY status
ORDER BY status;

-- 4. Show recent completed transfers (last 10)
SELECT 
    id,
    from_storage_name,
    to_storage_name,
    size_class,
    quantity,
    weight_kg,
    created_at,
    approved_by,
    approved_at,
    completed_at
FROM transfers 
WHERE status = 'completed'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Summary of completed transfers by size
SELECT 
    size_class,
    COUNT(*) as transfer_count,
    SUM(quantity) as total_pieces,
    SUM(weight_kg) as total_weight_kg
FROM transfers 
WHERE status = 'completed'
GROUP BY size_class
ORDER BY size_class;
