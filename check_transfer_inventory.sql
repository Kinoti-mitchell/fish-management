-- Check Transfer Inventory Movement
-- Simple script to check if approved transfers actually moved inventory

-- 1. Check Processing Area 2 - Size 1 (should have 1208.0kg moved out)
SELECT 'Processing Area 2 - Size 1 Inventory' as location;
SELECT 
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Processing Area 2' AND sr.size_class = 1;

-- 2. Check Cold Storage B - Size 1 (should have 1208.0kg moved in)
SELECT 'Cold Storage B - Size 1 Inventory' as location;
SELECT 
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Cold Storage B' AND sr.size_class = 1;

-- 3. Check Freezer Unit 1 inventory (batch should have moved out)
SELECT 'Freezer Unit 1 - All Sizes' as location;
SELECT 
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Freezer Unit 1'
ORDER BY sr.size_class;

-- 4. Check Cold Storage A inventory (batch should have moved in)
SELECT 'Cold Storage A - All Sizes' as location;
SELECT 
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Cold Storage A'
ORDER BY sr.size_class;

-- 5. Check all storage locations with inventory
SELECT 'All Storage Locations with Inventory' as summary;
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
