-- Verify Transfer Fix
-- This script checks if the inventory was actually moved after running the fix

-- 1. Check Processing Area 2 - Size 1 (should be reduced or gone)
SELECT 'Processing Area 2 - Size 1 (Should be reduced after fix)' as check_type;
SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sr.updated_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Processing Area 2' AND sr.size_class = 1;

-- 2. Check Cold Storage B - Size 1 (should have the moved inventory)
SELECT 'Cold Storage B - Size 1 (Should have moved inventory)' as check_type;
SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sr.updated_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Cold Storage B' AND sr.size_class = 1;

-- 3. Check all Size 1 inventory across all storage locations
SELECT 'All Size 1 Inventory After Fix' as check_type;
SELECT 
    sl.name as storage_name,
    sr.id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sr.updated_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sr.size_class = 1
ORDER BY sl.name, sr.updated_at DESC;

-- 4. Check transfer status
SELECT 'Transfer Status After Fix' as check_type;
SELECT 
    t.id,
    t.from_storage_name,
    t.to_storage_name,
    t.size_class,
    t.weight_kg,
    t.status,
    t.approved_at,
    t.updated_at
FROM transfers t
WHERE t.from_storage_name = 'Processing Area 2' 
AND t.to_storage_name = 'Cold Storage B'
AND t.size_class = 1
ORDER BY t.created_at DESC;

-- 5. Summary of all storage locations
SELECT 'Storage Summary After Fix' as check_type;
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
