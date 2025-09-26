-- Check Sorting Results Table
-- This script examines the current inventory distribution in sorting_results

-- 1. Check overall sorting_results structure
SELECT '=== SORTING RESULTS TABLE STRUCTURE ===' as section;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sorting_results' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check total inventory by storage location
SELECT '=== INVENTORY BY STORAGE LOCATION ===' as section;

SELECT 
    sl.name as storage_name,
    sl.location_type,
    sl.status as storage_status,
    COUNT(sr.id) as inventory_records,
    SUM(sr.total_pieces) as total_pieces,
    SUM(sr.total_weight_grams) as total_weight_grams,
    ROUND(SUM(sr.total_weight_grams) / 1000.0, 2) as total_weight_kg
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
GROUP BY sl.id, sl.name, sl.location_type, sl.status
ORDER BY total_weight_kg DESC;

-- 3. Check inventory by size class and storage
SELECT '=== INVENTORY BY SIZE CLASS AND STORAGE ===' as section;

SELECT 
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sr.created_at,
    sr.updated_at
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
ORDER BY sl.name, sr.size_class;

-- 4. Check for specific transfers mentioned in the history
SELECT '=== CHECKING SPECIFIC TRANSFER INVENTORY ===' as section;

-- Check Processing Area 2 inventory (should have Size 1 moved out)
SELECT 
    'Processing Area 2 - Size 1' as check_type,
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Processing Area 2' AND sr.size_class = 1;

-- Check Cold Storage B inventory (should have Size 1 moved in)
SELECT 
    'Cold Storage B - Size 1' as check_type,
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Cold Storage B' AND sr.size_class = 1;

-- Check Freezer Unit 1 inventory (should have batch moved out)
SELECT 
    'Freezer Unit 1 - Batch' as check_type,
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Freezer Unit 1'
ORDER BY sr.size_class;

-- Check Cold Storage A inventory (should have batch moved in)
SELECT 
    'Cold Storage A - Batch' as check_type,
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Cold Storage A'
ORDER BY sr.size_class;

-- 5. Check for any orphaned records (storage_location_id that doesn't exist)
SELECT '=== CHECKING FOR ORPHANED RECORDS ===' as section;

SELECT 
    sr.id,
    sr.storage_location_id,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    'ORPHANED - No storage location found' as issue
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.id IS NULL;

-- 6. Check recent updates to sorting_results
SELECT '=== RECENT UPDATES TO SORTING RESULTS ===' as section;

SELECT 
    sr.id,
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sr.created_at,
    sr.updated_at,
    CASE 
        WHEN sr.updated_at > sr.created_at THEN 'UPDATED'
        ELSE 'ORIGINAL'
    END as record_status
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
ORDER BY sr.updated_at DESC, sr.created_at DESC
LIMIT 20;

SELECT 'Sorting results check completed!' as status;
