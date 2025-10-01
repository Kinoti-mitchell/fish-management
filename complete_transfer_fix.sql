-- Complete Transfer Fix - Move All Approved Transfers
-- This will move the remaining approved transfers that didn't move

-- 1. Check current approved transfers that need to be moved
SELECT '=== CHECKING APPROVED TRANSFERS ===' as status;

SELECT 
    t.id,
    t.from_storage_name,
    t.to_storage_name,
    t.size_class,
    t.quantity,
    t.status,
    t.approved_at
FROM transfers t
WHERE t.status = 'approved'
AND t.from_storage_name = 'Cold Storage A'
AND t.to_storage_name = 'Cold Storage B'
ORDER BY t.approved_at DESC;

-- 2. Move remaining inventory for approved transfers
-- Move Size 0, 2, 3 inventory from Cold Storage A to Cold Storage B
UPDATE sorting_results 
SET 
    storage_location_id = (SELECT id FROM storage_locations WHERE name = 'Cold Storage B'),
    updated_at = NOW()
WHERE storage_location_id = (SELECT id FROM storage_locations WHERE name = 'Cold Storage A')
AND size_class IN (0, 2, 3)
AND total_pieces > 0;

-- 3. Update storage capacity calculations
UPDATE storage_locations 
SET current_usage_kg = (
    SELECT COALESCE(SUM(total_weight_grams) / 1000.0, 0)
    FROM sorting_results sr
    WHERE sr.storage_location_id = storage_locations.id
),
updated_at = NOW()
WHERE name IN ('Cold Storage A', 'Cold Storage B');

-- 4. Check results after fix
SELECT '=== RESULTS AFTER FIX ===' as status;

SELECT 
    sl.name as storage_name,
    sl.capacity_kg,
    sl.current_usage_kg,
    ROUND((sl.current_usage_kg / sl.capacity_kg) * 100, 2) as utilization_percent,
    COUNT(sr.id) as batch_count
FROM storage_locations sl
LEFT JOIN sorting_results sr ON sl.id = sr.storage_location_id
WHERE sl.name IN ('Cold Storage A', 'Cold Storage B')
GROUP BY sl.id, sl.name, sl.capacity_kg, sl.current_usage_kg
ORDER BY sl.name;

-- 5. Show inventory by size after fix
SELECT '=== INVENTORY BY SIZE AFTER FIX ===' as status;

SELECT 
    sl.name as storage_name,
    sr.size_class,
    SUM(sr.total_pieces) as total_pieces,
    ROUND(SUM(sr.total_weight_grams) / 1000.0, 2) as total_weight_kg
FROM storage_locations sl
JOIN sorting_results sr ON sl.id = sr.storage_location_id
WHERE sl.name IN ('Cold Storage A', 'Cold Storage B')
GROUP BY sl.name, sr.size_class
ORDER BY sl.name, sr.size_class;

SELECT 'Transfer fix completed successfully' as final_status;