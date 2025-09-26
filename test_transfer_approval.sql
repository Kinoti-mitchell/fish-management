-- Test Transfer Approval
-- This script tests if the transfer approval actually works

-- 1. First, let's see what we have
SELECT 'BEFORE APPROVAL - Pending Transfers:' as test_step;
SELECT 
    id,
    from_storage_name,
    to_storage_name,
    size_class,
    quantity,
    weight_kg,
    status
FROM transfers 
WHERE status = 'pending'
ORDER BY created_at DESC;

-- 2. Check inventory in source storage before approval
SELECT 'BEFORE APPROVAL - Source Storage Inventory:' as test_step;
SELECT 
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name IN ('Processing Area 2', 'test')
AND sr.total_weight_grams > 0
ORDER BY sl.name, sr.size_class;

-- 3. Check inventory in destination storage before approval
SELECT 'BEFORE APPROVAL - Destination Storage Inventory:' as test_step;
SELECT 
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name IN ('Cold Storage A', 'Cold Storage B')
AND sr.total_weight_grams > 0
ORDER BY sl.name, sr.size_class;

-- 4. Try to approve the first pending transfer (if any exist)
-- Replace 'YOUR_USER_ID' with an actual user ID from your system
SELECT 'TESTING APPROVAL...' as test_step;

-- Get a user ID to use for approval
SELECT id as user_id FROM auth.users LIMIT 1;

-- 5. Show what happens after approval (you'll need to run the approval manually)
SELECT 'After you approve a transfer, run this query to see the results:' as instruction;
SELECT 'SELECT * FROM transfers WHERE status = ''approved'' ORDER BY approved_at DESC;' as query_to_run;
