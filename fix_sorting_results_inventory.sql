-- Fix Inventory Movement in Sorting Results Table
-- This script moves inventory by changing storage_location_id in sorting_results

-- 1. Check current Size 1 inventory in Processing Area 2
SELECT 'Current Size 1 in Processing Area 2' as check_type;
SELECT 
    sr.id,
    sr.storage_location_id,
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Processing Area 2' AND sr.size_class = 1;

-- 2. Get Cold Storage B storage_location_id
SELECT 'Cold Storage B ID' as check_type;
SELECT 
    id,
    name,
    location_type
FROM storage_locations 
WHERE name = 'Cold Storage B';

-- 3. Check current Size 1 inventory in Cold Storage B
SELECT 'Current Size 1 in Cold Storage B' as check_type;
SELECT 
    sr.id,
    sr.storage_location_id,
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Cold Storage B' AND sr.size_class = 1;

-- 4. Move Size 1 inventory from Processing Area 2 to Cold Storage B
-- First, let's see what we're about to move
SELECT 'About to Move This Inventory' as check_type;
SELECT 
    sr.id,
    sr.storage_location_id as current_storage_id,
    sl.name as current_storage_name,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Processing Area 2' AND sr.size_class = 1;

-- 5. Actually move the inventory (UPDATE the storage_location_id)
-- Replace 'COLD_STORAGE_B_ID' with the actual ID from step 2
UPDATE sorting_results 
SET 
    storage_location_id = (SELECT id FROM storage_locations WHERE name = 'Cold Storage B'),
    updated_at = NOW()
WHERE storage_location_id = (SELECT id FROM storage_locations WHERE name = 'Processing Area 2')
AND size_class = 1;

-- 6. Check the results after the move
SELECT 'After Move - Processing Area 2 Size 1' as check_type;
SELECT 
    sr.id,
    sr.storage_location_id,
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Processing Area 2' AND sr.size_class = 1;

SELECT 'After Move - Cold Storage B Size 1' as check_type;
SELECT 
    sr.id,
    sr.storage_location_id,
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Cold Storage B' AND sr.size_class = 1;

-- 7. Summary of all storage locations after the move
SELECT 'Storage Summary After Move' as check_type;
SELECT 
    sl.name as storage_name,
    sl.location_type,
    COUNT(*) as inventory_records,
    SUM(sr.total_pieces) as total_pieces,
    ROUND(SUM(sr.total_weight_grams) / 1000.0, 2) as total_weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
GROUP BY sl.id, sl.name, sl.location_type
ORDER BY total_weight_kg DESC;
