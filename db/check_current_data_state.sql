-- Quick Check of Current Data State
-- Run this to see what data exists in your system

-- Check all main tables
SELECT '=== TABLE RECORD COUNTS ===' as section;

SELECT 'warehouse_entries' as table_name, COUNT(*) as record_count FROM warehouse_entries
UNION ALL
SELECT 'processing_records' as table_name, COUNT(*) as record_count FROM processing_records
UNION ALL
SELECT 'fish_inventory' as table_name, COUNT(*) as record_count FROM fish_inventory
UNION ALL
SELECT 'sorting_batches' as table_name, COUNT(*) as record_count FROM sorting_batches
UNION ALL
SELECT 'sorting_results' as table_name, COUNT(*) as record_count FROM sorting_results
UNION ALL
SELECT 'storage_locations' as table_name, COUNT(*) as record_count FROM storage_locations;

-- Check processing records details
SELECT '=== PROCESSING RECORDS ===' as section;

SELECT 
    id,
    processing_date,
    post_processing_weight,
    ready_for_dispatch_count,
    created_at
FROM processing_records
ORDER BY created_at DESC
LIMIT 5;

-- Check if processing records have been sorted
SELECT '=== PROCESSING → SORTING STATUS ===' as section;

SELECT 
    pr.id as processing_id,
    pr.processing_date,
    pr.post_processing_weight,
    CASE 
        WHEN sb.id IS NOT NULL THEN 'HAS sorting batch'
        ELSE 'NO sorting batch'
    END as sorting_status,
    sb.batch_number,
    sb.status as batch_status
FROM processing_records pr
LEFT JOIN sorting_batches sb ON pr.id = sb.processing_record_id
ORDER BY pr.created_at DESC
LIMIT 10;

-- Check sorting results (this is your inventory!)
SELECT '=== SORTING RESULTS (YOUR INVENTORY) ===' as section;

SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sb.batch_number,
    sb.status as batch_status,
    sl.name as storage_location
FROM sorting_results sr
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
ORDER BY sr.created_at DESC
LIMIT 10;

-- Check storage locations
SELECT '=== STORAGE LOCATIONS ===' as section;

SELECT 
    id,
    name,
    capacity_kg,
    current_usage_kg,
    status
FROM storage_locations
ORDER BY name;

-- Summary
SELECT '=== SUMMARY ===' as section;
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM sorting_results) > 0 THEN '✅ You have inventory data in sorting_results'
        ELSE '❌ No inventory data in sorting_results - this is why you see no data!'
    END as inventory_status,
    CASE 
        WHEN (SELECT COUNT(*) FROM processing_records) > 0 THEN '✅ You have processing records'
        ELSE '❌ No processing records found'
    END as processing_status,
    CASE 
        WHEN (SELECT COUNT(*) FROM sorting_batches) > 0 THEN '✅ You have sorting batches'
        ELSE '❌ No sorting batches - processing data not sorted yet'
    END as sorting_status;
