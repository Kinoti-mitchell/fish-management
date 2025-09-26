-- Debug Inventory Movement Issue
-- This script investigates why the inventory movement didn't work

-- 1. Check if Size 1 inventory still exists in Processing Area 2
SELECT 'Processing Area 2 - Size 1 Inventory' as check_type;
SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sr.created_at,
    sr.updated_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Processing Area 2' AND sr.size_class = 1;

-- 2. Check what's actually in Cold Storage B
SELECT 'Cold Storage B - All Inventory' as check_type;
SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sr.created_at,
    sr.updated_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Cold Storage B'
ORDER BY sr.size_class;

-- 3. Check the transfer record details
SELECT 'Transfer Record Details' as check_type;
SELECT 
    t.id,
    t.from_storage_name,
    t.to_storage_name,
    t.size_class,
    t.quantity,
    t.weight_kg,
    t.status,
    t.created_at,
    t.approved_at,
    t.updated_at
FROM transfers t
WHERE t.from_storage_name = 'Processing Area 2' 
AND t.to_storage_name = 'Cold Storage B'
AND t.size_class = 1
ORDER BY t.created_at DESC;

-- 4. Check if there are any records with 0 weight_grams
SELECT 'Records with Zero Weight in Cold Storage B' as check_type;
SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    sr.created_at,
    sr.updated_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Cold Storage B' 
AND (sr.total_weight_grams = 0 OR sr.total_weight_grams IS NULL);

-- 5. Check if the approval function exists and works
SELECT 'Check if Approval Function Exists' as check_type;
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'approve_transfer';

-- 6. Try to manually move the inventory (for testing)
SELECT 'Manual Inventory Check - Before Move' as check_type;
SELECT 
    'Processing Area 2' as location,
    COUNT(*) as size_1_records,
    SUM(total_pieces) as total_pieces,
    SUM(total_weight_grams) as total_weight_grams
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Processing Area 2' AND sr.size_class = 1;
