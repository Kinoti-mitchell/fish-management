-- Debug Processing Data Relationships
-- This script checks the relationships that the frontend is trying to use

-- Check processing_records and their relationships
SELECT '=== PROCESSING RECORDS WITH RELATIONSHIPS ===' as section;

SELECT 
    pr.id,
    pr.processing_date,
    pr.post_processing_weight,
    pr.ready_for_dispatch_count,
    pr.warehouse_entry_id,
    we.id as warehouse_entry_exists,
    we.farmer_id,
    f.id as farmer_exists,
    f.name as farmer_name
FROM processing_records pr
LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
LEFT JOIN farmers f ON we.farmer_id = f.id
ORDER BY pr.created_at DESC
LIMIT 10;

-- Check for processing records with missing warehouse entries
SELECT '=== PROCESSING RECORDS WITH MISSING WAREHOUSE ENTRIES ===' as section;

SELECT 
    pr.id,
    pr.processing_date,
    pr.warehouse_entry_id,
    'Missing warehouse entry' as issue
FROM processing_records pr
LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
WHERE we.id IS NULL;

-- Check for warehouse entries with missing farmers
SELECT '=== WAREHOUSE ENTRIES WITH MISSING FARMERS ===' as section;

SELECT 
    we.id,
    we.entry_date,
    we.farmer_id,
    'Missing farmer' as issue
FROM warehouse_entries we
LEFT JOIN farmers f ON we.farmer_id = f.id
WHERE f.id IS NULL;

-- Check what the frontend query would return (with INNER JOINs)
SELECT '=== FRONTEND QUERY RESULT (INNER JOINS) ===' as section;

SELECT 
    pr.id,
    pr.processing_date,
    pr.post_processing_weight,
    pr.ready_for_dispatch_count,
    we.id as warehouse_entry_id,
    f.name as farmer_name
FROM processing_records pr
INNER JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
INNER JOIN farmers f ON we.farmer_id = f.id
ORDER BY pr.processing_date DESC
LIMIT 10;

-- Check what the frontend query would return (with LEFT JOINs - safer)
SELECT '=== FRONTEND QUERY RESULT (LEFT JOINS - SAFER) ===' as section;

SELECT 
    pr.id,
    pr.processing_date,
    pr.post_processing_weight,
    pr.ready_for_dispatch_count,
    we.id as warehouse_entry_id,
    COALESCE(f.name, 'Unknown Farmer') as farmer_name
FROM processing_records pr
LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
LEFT JOIN farmers f ON we.farmer_id = f.id
ORDER BY pr.processing_date DESC
LIMIT 10;

-- Summary
SELECT '=== SUMMARY ===' as section;
SELECT 
    (SELECT COUNT(*) FROM processing_records) as total_processing_records,
    (SELECT COUNT(*) FROM processing_records pr INNER JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id INNER JOIN farmers f ON we.farmer_id = f.id) as records_with_complete_relationships,
    (SELECT COUNT(*) FROM processing_records pr LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id LEFT JOIN farmers f ON we.farmer_id = f.id) as records_with_left_joins;
