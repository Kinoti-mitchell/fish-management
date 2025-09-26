-- Test Processing Data Access
-- This script tests the exact queries that the frontend is trying to use

-- Test 1: Simple processing_records query (what useProcessing hook uses)
SELECT '=== TEST 1: Simple processing_records query ===' as test;

SELECT 
    id,
    processing_date,
    post_processing_weight,
    ready_for_dispatch_count,
    created_at
FROM processing_records
ORDER BY processing_date DESC
LIMIT 5;

-- Test 2: Processing records with warehouse entries (LEFT JOIN - safer)
SELECT '=== TEST 2: Processing records with warehouse entries (LEFT JOIN) ===' as test;

SELECT 
    pr.id,
    pr.processing_date,
    pr.post_processing_weight,
    pr.ready_for_dispatch_count,
    we.id as warehouse_entry_id,
    we.entry_date,
    f.name as farmer_name
FROM processing_records pr
LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
LEFT JOIN farmers f ON we.farmer_id = f.id
ORDER BY pr.processing_date DESC
LIMIT 5;

-- Test 3: Processing records with warehouse entries (INNER JOIN - what frontend was using)
SELECT '=== TEST 3: Processing records with warehouse entries (INNER JOIN) ===' as test;

SELECT 
    pr.id,
    pr.processing_date,
    pr.post_processing_weight,
    pr.ready_for_dispatch_count,
    we.id as warehouse_entry_id,
    we.entry_date,
    f.name as farmer_name
FROM processing_records pr
INNER JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
INNER JOIN farmers f ON we.farmer_id = f.id
ORDER BY pr.processing_date DESC
LIMIT 5;

-- Test 4: Check for missing relationships
SELECT '=== TEST 4: Missing relationships check ===' as test;

SELECT 
    'Processing records without warehouse entries' as issue,
    COUNT(*) as count
FROM processing_records pr
LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
WHERE we.id IS NULL

UNION ALL

SELECT 
    'Warehouse entries without farmers' as issue,
    COUNT(*) as count
FROM warehouse_entries we
LEFT JOIN farmers f ON we.farmer_id = f.id
WHERE f.id IS NULL;

-- Test 5: Check RLS policies
SELECT '=== TEST 5: RLS Policy Status ===' as test;

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relkind = 'r'
AND tablename IN ('processing_records', 'warehouse_entries', 'farmers')
ORDER BY tablename;

-- Summary
SELECT '=== SUMMARY ===' as test;
SELECT 
    (SELECT COUNT(*) FROM processing_records) as total_processing_records,
    (SELECT COUNT(*) FROM processing_records pr LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id LEFT JOIN farmers f ON we.farmer_id = f.id) as records_with_left_joins,
    (SELECT COUNT(*) FROM processing_records pr INNER JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id INNER JOIN farmers f ON we.farmer_id = f.id) as records_with_inner_joins;
