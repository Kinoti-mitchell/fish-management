-- Debug Pending Transfers Issue
-- This will help identify the disconnect between app display and database

-- 1. Check all transfers in the database
SELECT 
    'All Transfers' as check_type,
    t.id,
    t.status,
    t.from_storage_name,
    t.to_storage_name,
    t.size_class,
    t.quantity,
    t.weight_kg,
    t.created_at,
    t.approved_at,
    t.approved_by
FROM transfers t
ORDER BY t.created_at DESC
LIMIT 20;

-- 2. Check specifically for pending transfers
SELECT 
    'Pending Transfers' as check_type,
    t.id,
    t.status,
    t.from_storage_name,
    t.to_storage_name,
    t.size_class,
    t.quantity,
    t.weight_kg,
    t.created_at,
    t.notes
FROM transfers t
WHERE t.status = 'pending'
ORDER BY t.created_at DESC;

-- 3. Check transfers involving "Cold Storage A"
SELECT 
    'Cold Storage A Transfers' as check_type,
    t.id,
    t.status,
    t.from_storage_name,
    t.to_storage_name,
    t.size_class,
    t.quantity,
    t.weight_kg,
    t.created_at,
    t.approved_at,
    t.approved_by
FROM transfers t
WHERE (t.from_storage_name ILIKE '%cold storage a%' 
       OR t.to_storage_name ILIKE '%cold storage a%')
ORDER BY t.created_at DESC;

-- 4. Check if there are any transfers with NULL status
SELECT 
    'Transfers with NULL Status' as check_type,
    t.id,
    t.status,
    t.from_storage_name,
    t.to_storage_name,
    t.size_class,
    t.quantity,
    t.weight_kg,
    t.created_at
FROM transfers t
WHERE t.status IS NULL
ORDER BY t.created_at DESC;

-- 5. Check the getTransferHistory function logic
-- Let's see what the function is actually returning
SELECT 
    'Function Test' as check_type,
    COUNT(*) as total_transfers,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
    COUNT(CASE WHEN status = 'declined' THEN 1 END) as declined_count
FROM transfers;

-- 6. Check storage locations to see if "Cold Storage A" exists
SELECT 
    'Storage Locations' as check_type,
    sl.id,
    sl.name,
    sl.status,
    sl.created_at
FROM storage_locations sl
WHERE sl.name ILIKE '%cold%'
ORDER BY sl.name;

-- Success message
SELECT 'Pending transfers debug completed - review results above' as status;
