-- TEST FRONTEND QUERIES - VERIFY THESE WORK
-- These are the exact queries your frontend is now using

-- Test 1: Simple processing_records query (useProcessing hook)
SELECT '=== TEST 1: Simple processing_records ===' as test;
SELECT 
    id,
    processing_date,
    post_processing_weight,
    ready_for_dispatch_count,
    created_at
FROM processing_records
ORDER BY processing_date DESC
LIMIT 3;

-- Test 2: Processing records with relationships (ProcessingManagement component)
SELECT '=== TEST 2: Processing with relationships ===' as test;
SELECT 
    pr.id,
    pr.processing_date,
    pr.post_processing_weight,
    pr.ready_for_dispatch_count,
    we.id as warehouse_entry_id,
    f.name as farmer_name
FROM processing_records pr
LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
LEFT JOIN farmers f ON we.farmer_id = f.id
ORDER BY pr.processing_date DESC
LIMIT 3;

-- Test 3: Storage locations
SELECT '=== TEST 3: Storage locations ===' as test;
SELECT 
    id,
    name,
    capacity_kg,
    current_usage_kg,
    status
FROM storage_locations
WHERE status = 'active'
ORDER BY name
LIMIT 5;

-- Test 4: Inventory data (sorting_results)
SELECT '=== TEST 4: Inventory data ===' as test;
SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sl.name as storage_location,
    sb.batch_number
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
WHERE sr.total_pieces > 0
ORDER BY sr.created_at DESC
LIMIT 5;

-- Summary
SELECT '=== SUMMARY ===' as test;
SELECT 
    'If you see data above, your frontend should work!' as status,
    (SELECT COUNT(*) FROM processing_records) as processing_count,
    (SELECT COUNT(*) FROM sorting_results) as inventory_count;
