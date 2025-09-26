-- Check if Transfers Actually Moved Inventory
-- This script checks if the approved transfers moved inventory between storage locations

-- 1. Check if Size 1 inventory exists in Processing Area 2 (should be reduced or gone)
SELECT 'Processing Area 2 - Size 1 (Should be reduced after transfer)' as check_type;
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

-- 2. Check if Size 1 inventory exists in Cold Storage B (should have 1208.0kg)
SELECT 'Cold Storage B - Size 1 (Should have 1208.0kg from transfer)' as check_type;
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
WHERE sl.name = 'Cold Storage B' AND sr.size_class = 1;

-- 3. Check all inventory in Cold Storage B to see what's there
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

-- 4. Check the specific transfer record
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
    t.approved_by
FROM transfers t
WHERE t.from_storage_name = 'Processing Area 2' 
AND t.to_storage_name = 'Cold Storage B'
AND t.size_class = 1
ORDER BY t.created_at DESC;

-- 5. Check if there are any records with the exact weight (1208.0kg = 1208000 grams)
SELECT 'Looking for 1208.0kg inventory' as check_type;
SELECT 
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sr.created_at,
    sr.updated_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sr.total_weight_grams = 1208000 OR ROUND(sr.total_weight_grams / 1000.0, 1) = 1208.0
ORDER BY sl.name, sr.size_class;
