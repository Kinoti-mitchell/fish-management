-- Basic test to check if disposal system works
-- Run this step by step to identify the issue

-- Step 1: Check if we can access disposal tables
SELECT 'Step 1: Testing disposal table access...' as test;

SELECT COUNT(*) as disposal_reasons_count FROM disposal_reasons;
SELECT COUNT(*) as disposal_records_count FROM disposal_records;

-- Step 2: Check if we can access sorting_results (inventory data)
SELECT 'Step 2: Testing inventory data access...' as test;

SELECT COUNT(*) as sorting_results_count FROM sorting_results;
SELECT COUNT(*) as storage_locations_count FROM storage_locations;

-- Step 3: Test if we can create a simple disposal reason
SELECT 'Step 3: Testing disposal reason creation...' as test;

INSERT INTO disposal_reasons (name, description) 
VALUES ('Test Reason', 'Test disposal reason for debugging')
ON CONFLICT (name) DO NOTHING;

SELECT id, name FROM disposal_reasons WHERE name = 'Test Reason';

-- Step 4: Test if we can create a disposal record
SELECT 'Step 4: Testing disposal record creation...' as test;

INSERT INTO disposal_records (
    disposal_number,
    disposal_reason_id,
    disposal_method,
    notes,
    status
) VALUES (
    'TEST-001',
    (SELECT id FROM disposal_reasons WHERE name = 'Test Reason'),
    'waste',
    'Test disposal record',
    'pending'
) RETURNING id, disposal_number;

-- Step 5: Check if we can query inventory for disposal (manual query)
SELECT 'Step 5: Testing manual inventory query for disposal...' as test;

SELECT 
    sr.id as sorting_result_id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    COALESCE(sl.name, 'Unknown Storage') as storage_location_name,
    COALESCE(f.name, 'Unknown Farmer') as farmer_name,
    EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date)))::INTEGER as days_in_storage
FROM sorting_results sr
JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
JOIN processing_records pr ON sb.processing_record_id = pr.id
JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
JOIN farmers f ON we.farmer_id = f.id
WHERE sb.status = 'completed'
AND sr.storage_location_id IS NOT NULL
AND sr.total_pieces > 0
LIMIT 5;

-- Step 6: Test if the generate_disposal_number function works
SELECT 'Step 6: Testing disposal number generation...' as test;

SELECT generate_disposal_number() as test_disposal_number;

-- Clean up test data
DELETE FROM disposal_records WHERE disposal_number = 'TEST-001';
DELETE FROM disposal_reasons WHERE name = 'Test Reason';

SELECT 'Test completed - check results above for any errors' as status;

