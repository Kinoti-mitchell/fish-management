-- Migrate Processing Data to Sorting System
-- This script migrates existing processing_records to the new sorting-based system
-- Run this to fix the "no data" issue in processing

-- Step 1: Check what data exists in the old system
SELECT '=== CHECKING EXISTING DATA ===' as section;

SELECT 'processing_records' as table_name, COUNT(*) as record_count FROM processing_records
UNION ALL
SELECT 'fish_inventory' as table_name, COUNT(*) as record_count FROM fish_inventory
UNION ALL
SELECT 'sorting_batches' as table_name, COUNT(*) as record_count FROM sorting_batches
UNION ALL
SELECT 'sorting_results' as table_name, COUNT(*) as record_count FROM sorting_results;

-- Step 2: Check if processing_records have been sorted
SELECT '=== PROCESSING RECORDS NOT YET SORTED ===' as section;

SELECT 
    pr.id,
    pr.processing_date,
    pr.post_processing_weight,
    pr.ready_for_dispatch_count,
    pr.created_at,
    CASE 
        WHEN sb.id IS NOT NULL THEN 'Already sorted'
        ELSE 'Not sorted'
    END as sorting_status
FROM processing_records pr
LEFT JOIN sorting_batches sb ON pr.id = sb.processing_record_id
ORDER BY pr.created_at DESC;

-- Step 3: Create sorting batches for processing records that haven't been sorted
-- This will create the missing link between processing and inventory

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
    'MIGRATED-' || pr.id::text,
    pr.post_processing_weight * 1000, -- Convert kg to grams
    pr.ready_for_dispatch_count,
    'completed', -- Mark as completed since processing is done
    'Migrated from processing_records - ' || pr.processing_date::text
FROM processing_records pr
WHERE NOT EXISTS (
    SELECT 1 FROM sorting_batches sb 
    WHERE sb.processing_record_id = pr.id
);

-- Step 4: Create sorting results for each migrated batch
-- This creates the inventory data that the frontend expects

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
    5, -- Default to size class 5 (medium-large) for migrated data
    sb.total_pieces,
    sb.total_weight_grams,
    sb.total_weight_grams / NULLIF(sb.total_pieces, 0), -- Calculate average
    '{"A": ' || sb.total_pieces || '}', -- Default to grade A
    (SELECT id FROM storage_locations WHERE name = 'Cold Storage A' LIMIT 1) -- Default storage
FROM sorting_batches sb
WHERE sb.batch_number LIKE 'MIGRATED-%'
AND NOT EXISTS (
    SELECT 1 FROM sorting_results sr 
    WHERE sr.sorting_batch_id = sb.id
);

-- Step 5: Verify the migration
SELECT '=== MIGRATION VERIFICATION ===' as section;

SELECT 
    'sorting_batches' as table_name, 
    COUNT(*) as total_records,
    COUNT(CASE WHEN batch_number LIKE 'MIGRATED-%' THEN 1 END) as migrated_records
FROM sorting_batches
UNION ALL
SELECT 
    'sorting_results' as table_name, 
    COUNT(*) as total_records,
    COUNT(CASE WHEN sorting_batch_id IN (
        SELECT id FROM sorting_batches WHERE batch_number LIKE 'MIGRATED-%'
    ) THEN 1 END) as migrated_records
FROM sorting_results;

-- Step 6: Show current inventory (this should now have data!)
SELECT '=== CURRENT INVENTORY (SHOULD NOW HAVE DATA!) ===' as section;

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

-- Step 7: Final status
SELECT '=== MIGRATION COMPLETE ===' as section;
SELECT 'Processing data has been migrated to the sorting system!' as status;
SELECT 'Your frontend should now show processing data!' as note;
