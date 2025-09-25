-- CHECK SIZE 9 IN STORAGE 1
-- This will show us exactly what Size 9 data exists in storage 1

SELECT '=== SIZE 9 IN STORAGE 1 ===' as section;

-- Check Size 9 in storage 1 specifically
SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    sr.storage_location_id,
    sr.sorting_batch_id,
    sr.created_at,
    sl.name as storage_name,
    sb.batch_number,
    sb.status as batch_status,
    sb.created_at as batch_created
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
WHERE sr.size_class = 9
AND sl.name = 'storage 1'
ORDER BY sr.created_at ASC;

SELECT '=== SIZE 9 IN ALL STORAGE LOCATIONS ===' as section;

-- Check Size 9 in all storage locations
SELECT 
    sl.name as storage_name,
    COUNT(*) as record_count,
    SUM(sr.total_pieces) as total_pieces,
    SUM(sr.total_weight_grams) as total_weight_grams,
    SUM(sr.total_weight_grams) / 1000.0 as total_weight_kg
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sr.size_class = 9
GROUP BY sl.name
ORDER BY total_weight_kg DESC;

SELECT '=== ALL SIZE 9 RECORDS ===' as section;

-- Show all Size 9 records
SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    sr.total_weight_grams / 1000.0 as weight_kg,
    sl.name as storage_name,
    sb.batch_number,
    sb.status as batch_status
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
WHERE sr.size_class = 9
ORDER BY sr.total_weight_grams DESC;
