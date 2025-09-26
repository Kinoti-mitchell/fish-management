-- Check Inventory Source Data
-- This script checks the sorting_results table which is the source of inventory data for transfers

-- 1. Check sorting results with size and weight data
SELECT 
    id,
    size_class,
    total_pieces,
    total_weight_grams,
    (total_weight_grams / 1000.0) as weight_kg,
    storage_location_id,
    sorting_batch_id,
    created_at
FROM sorting_results 
WHERE total_weight_grams > 0
ORDER BY created_at DESC
LIMIT 20;

-- 2. Check size distribution in sorting results
SELECT 
    size_class,
    COUNT(*) as result_count,
    SUM(total_pieces) as total_pieces,
    SUM(total_weight_grams) as total_weight_grams,
    AVG(total_weight_grams) as avg_weight_grams,
    MIN(total_weight_grams) as min_weight_grams,
    MAX(total_weight_grams) as max_weight_grams
FROM sorting_results 
WHERE total_weight_grams > 0
GROUP BY size_class
ORDER BY size_class;

-- 3. Check storage locations
SELECT 
    id,
    name,
    location_type,
    capacity_kg,
    status
FROM storage_locations
ORDER BY name;

-- 4. Check if there are any sorting results with zero or null weights
SELECT 
    COUNT(*) as total_results,
    COUNT(CASE WHEN total_weight_grams IS NULL OR total_weight_grams = 0 THEN 1 END) as zero_weight_results,
    COUNT(CASE WHEN size_class IS NULL THEN 1 END) as null_size_results
FROM sorting_results;

-- 5. Check recent sorting results for data quality
SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    (sr.total_weight_grams / 1000.0) as weight_kg,
    sl.name as storage_name,
    sr.created_at,
    CASE 
        WHEN sr.total_weight_grams > 0 AND sr.size_class IS NOT NULL AND sl.name IS NOT NULL
        THEN 'GOOD' 
        ELSE 'NEEDS_FIX' 
    END as data_quality
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
ORDER BY sr.created_at DESC
LIMIT 10;
