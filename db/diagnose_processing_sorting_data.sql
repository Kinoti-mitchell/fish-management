-- Diagnostic Script for Processing and Sorting Data
-- This script helps identify what data exists and what might be missing

-- Step 1: Check if the main tables exist and have data
SELECT '=== TABLE EXISTENCE AND DATA CHECK ===' as section;

SELECT 
    schemaname,
    tablename,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE tablename IN ('processing_records', 'sorting_batches', 'sorting_results', 'storage_locations', 'inventory_entries', 'fish_inventory')
ORDER BY tablename;

-- Step 2: Check record counts in each table
SELECT '=== RECORD COUNTS ===' as section;

SELECT 'processing_records' as table_name, COUNT(*) as record_count FROM processing_records
UNION ALL
SELECT 'sorting_batches' as table_name, COUNT(*) as record_count FROM sorting_batches
UNION ALL
SELECT 'sorting_results' as table_name, COUNT(*) as record_count FROM sorting_results
UNION ALL
SELECT 'storage_locations' as table_name, COUNT(*) as record_count FROM storage_locations
UNION ALL
SELECT 'inventory_entries' as table_name, COUNT(*) as record_count FROM inventory_entries
UNION ALL
SELECT 'fish_inventory' as table_name, COUNT(*) as record_count FROM fish_inventory;

-- Step 3: Check processing records details
SELECT '=== PROCESSING RECORDS DETAILS ===' as section;

SELECT 
    id,
    processing_date,
    post_processing_weight,
    ready_for_dispatch_count,
    processing_yield,
    created_at
FROM processing_records
ORDER BY created_at DESC
LIMIT 10;

-- Step 4: Check sorting batches details
SELECT '=== SORTING BATCHES DETAILS ===' as section;

SELECT 
    sb.id,
    sb.batch_number,
    sb.status,
    sb.total_weight_grams,
    sb.total_pieces,
    sb.created_at,
    pr.processing_date
FROM sorting_batches sb
LEFT JOIN processing_records pr ON sb.processing_record_id = pr.id
ORDER BY sb.created_at DESC
LIMIT 10;

-- Step 5: Check sorting results details (this is your inventory!)
SELECT '=== SORTING RESULTS DETAILS (YOUR INVENTORY) ===' as section;

SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    sr.storage_location_id,
    sl.name as storage_location_name,
    sb.batch_number,
    sb.status as batch_status,
    sr.created_at
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
ORDER BY sr.created_at DESC
LIMIT 20;

-- Step 6: Check storage locations
SELECT '=== STORAGE LOCATIONS ===' as section;

SELECT 
    id,
    name,
    location_type,
    capacity_kg,
    current_usage_kg,
    status,
    created_at
FROM storage_locations
ORDER BY name;

-- Step 7: Check for any completed sorting batches that should have inventory
SELECT '=== COMPLETED SORTING BATCHES WITHOUT RESULTS ===' as section;

SELECT 
    sb.id,
    sb.batch_number,
    sb.status,
    sb.total_weight_grams,
    sb.total_pieces,
    sb.created_at,
    COUNT(sr.id) as result_count
FROM sorting_batches sb
LEFT JOIN sorting_results sr ON sb.id = sr.sorting_batch_id
WHERE sb.status = 'completed'
GROUP BY sb.id, sb.batch_number, sb.status, sb.total_weight_grams, sb.total_pieces, sb.created_at
HAVING COUNT(sr.id) = 0
ORDER BY sb.created_at DESC;

-- Step 8: Check for any sorting results without storage location
SELECT '=== SORTING RESULTS WITHOUT STORAGE LOCATION ===' as section;

SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    sr.storage_location_id,
    sb.batch_number,
    sr.created_at
FROM sorting_results sr
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
WHERE sr.storage_location_id IS NULL
ORDER BY sr.created_at DESC;

-- Step 9: Summary of current inventory by size and storage
SELECT '=== CURRENT INVENTORY SUMMARY ===' as section;

SELECT 
    sl.name as storage_location,
    sr.size_class,
    SUM(sr.total_pieces) as total_pieces,
    ROUND(SUM(sr.total_weight_grams) / 1000.0, 2) as total_weight_kg,
    COUNT(DISTINCT sr.sorting_batch_id) as batch_count
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
WHERE sb.status = 'completed'
AND sr.total_pieces > 0
GROUP BY sl.name, sr.size_class
ORDER BY sl.name, sr.size_class;

-- Step 10: Check for any RLS policy issues
SELECT '=== RLS POLICY STATUS ===' as section;

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    relrowsecurity as rls_forced
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relkind = 'r'
AND tablename IN ('processing_records', 'sorting_batches', 'sorting_results', 'storage_locations')
ORDER BY tablename;

-- Step 11: Check for any missing functions
SELECT '=== FUNCTION AVAILABILITY ===' as section;

SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_name IN ('add_stock_from_sorting', 'check_processing_sorting_data_integrity', 'get_current_inventory_from_sorting_results')
AND routine_schema = 'public'
ORDER BY routine_name;

-- Final summary
SELECT '=== DIAGNOSTIC COMPLETE ===' as section;
SELECT 'If you see no data in sorting_results, that is why you have no inventory!' as important_note;
