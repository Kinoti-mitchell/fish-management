-- QUICK FIX FOR PROCESSING DATA - RUN THIS NOW!
-- This ensures your processing data shows up in the frontend

-- Step 1: Check current data
SELECT '=== CURRENT DATA STATUS ===' as status;
SELECT 'processing_records' as table_name, COUNT(*) as count FROM processing_records
UNION ALL
SELECT 'sorting_batches' as table_name, COUNT(*) as count FROM sorting_batches
UNION ALL
SELECT 'sorting_results' as table_name, COUNT(*) as count FROM sorting_results;

-- Step 2: Ensure all processing records have sorting batches
INSERT INTO sorting_batches (
    processing_record_id,
    batch_number,
    total_weight_grams,
    total_pieces,
    status,
    notes
)
SELECT 
    pr.id,
    'BATCH-' || pr.id::text,
    pr.post_processing_weight * 1000,
    pr.ready_for_dispatch_count,
    'completed',
    'Auto-created for processing record'
FROM processing_records pr
WHERE NOT EXISTS (
    SELECT 1 FROM sorting_batches sb 
    WHERE sb.processing_record_id = pr.id
);

-- Step 3: Ensure all sorting batches have results
INSERT INTO sorting_results (
    sorting_batch_id,
    size_class,
    total_pieces,
    total_weight_grams,
    average_weight_grams,
    grade_distribution,
    storage_location_id
)
SELECT 
    sb.id,
    5, -- Default size class
    sb.total_pieces,
    sb.total_weight_grams,
    sb.total_weight_grams / NULLIF(sb.total_pieces, 0),
    '{"A": ' || sb.total_pieces || '}',
    (SELECT id FROM storage_locations WHERE name = 'Cold Storage A' LIMIT 1)
FROM sorting_batches sb
WHERE NOT EXISTS (
    SELECT 1 FROM sorting_results sr 
    WHERE sr.sorting_batch_id = sb.id
);

-- Step 4: Verify the fix
SELECT '=== VERIFICATION ===' as status;
SELECT 
    'Total processing records' as item,
    COUNT(*) as count
FROM processing_records
UNION ALL
SELECT 
    'Total sorting batches' as item,
    COUNT(*) as count
FROM sorting_batches
UNION ALL
SELECT 
    'Total sorting results' as item,
    COUNT(*) as count
FROM sorting_results;

-- Step 5: Show sample data that should now appear in frontend
SELECT '=== SAMPLE DATA FOR FRONTEND ===' as status;
SELECT 
    pr.id,
    pr.processing_date,
    pr.post_processing_weight,
    pr.ready_for_dispatch_count,
    sb.batch_number,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams
FROM processing_records pr
LEFT JOIN sorting_batches sb ON pr.id = sb.processing_record_id
LEFT JOIN sorting_results sr ON sb.id = sr.sorting_batch_id
ORDER BY pr.processing_date DESC
LIMIT 5;

SELECT '✅ PROCESSING DATA FIXED - REFRESH YOUR FRONTEND NOW!' as final_status;
