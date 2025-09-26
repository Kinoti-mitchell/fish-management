-- Check Specific Transfer Details
-- This script checks the exact transfer that should have moved 1208.0kg

-- 1. Check the exact transfer record for Processing Area 2 to Cold Storage B
SELECT 'Transfer Record - Processing Area 2 to Cold Storage B' as check_type;
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
    t.approved_by,
    t.notes
FROM transfers t
WHERE t.from_storage_name = 'Processing Area 2' 
AND t.to_storage_name = 'Cold Storage B'
AND t.size_class = 1
ORDER BY t.created_at DESC;

-- 2. Check if there's any Size 1 inventory in Processing Area 2
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

-- 3. Check if there's any Size 1 inventory in Cold Storage B
SELECT 'Cold Storage B - Size 1 Inventory' as check_type;
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

-- 4. Check all Size 1 inventory across all storage locations
SELECT 'All Size 1 Inventory Across All Storage' as check_type;
SELECT 
    sl.name as storage_name,
    sr.id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sr.created_at,
    sr.updated_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sr.size_class = 1
ORDER BY sl.name, sr.created_at;

-- 5. Check if there are any records with exactly 1208.0kg (1208000 grams)
SELECT 'Looking for 1208.0kg Records' as check_type;
SELECT 
    sl.name as storage_name,
    sr.id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sr.created_at,
    sr.updated_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sr.total_weight_grams = 1208000
ORDER BY sl.name;

-- 6. Check if there are any records with weight close to 1208.0kg (within 10%)
SELECT 'Looking for Records Close to 1208.0kg' as check_type;
SELECT 
    sl.name as storage_name,
    sr.id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sr.created_at,
    sr.updated_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sr.total_weight_grams BETWEEN 1087200 AND 1328800  -- 1208.0kg ± 10%
ORDER BY sl.name;
