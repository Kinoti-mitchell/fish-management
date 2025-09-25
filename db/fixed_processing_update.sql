-- Fixed Processing Records Update (No fish_type column)
-- This script works with the actual warehouse_entries table structure

-- Step 1: Check current state
SELECT 
    'BEFORE UPDATE - Processing records analysis:' as phase,
    COUNT(*) as total_records,
    COUNT(CASE WHEN ready_for_dispatch_count > 0 THEN 1 END) as with_fish_count,
    COUNT(CASE WHEN ready_for_dispatch_count IS NULL OR ready_for_dispatch_count = 0 THEN 1 END) as without_fish_count
FROM processing_records;

-- Step 2: Update from warehouse entries where total_pieces is available
UPDATE processing_records 
SET 
    ready_for_dispatch_count = we.total_pieces,
    updated_at = NOW()
FROM warehouse_entries we
WHERE processing_records.warehouse_entry_id = we.id
AND (processing_records.ready_for_dispatch_count IS NULL OR processing_records.ready_for_dispatch_count = 0)
AND we.total_pieces IS NOT NULL
AND we.total_pieces > 0;

-- Step 3: For records where total_pieces is not available, estimate from weight
-- Using a reasonable average weight of 0.5kg per fish
UPDATE processing_records 
SET 
    ready_for_dispatch_count = GREATEST(1, ROUND(post_processing_weight / 0.5)),
    updated_at = NOW()
WHERE ready_for_dispatch_count IS NULL OR ready_for_dispatch_count = 0;

-- Step 4: Show results
SELECT 
    'AFTER UPDATE - Processing records analysis:' as phase,
    COUNT(*) as total_records,
    COUNT(CASE WHEN ready_for_dispatch_count > 0 THEN 1 END) as with_fish_count,
    COUNT(CASE WHEN ready_for_dispatch_count IS NULL OR ready_for_dispatch_count = 0 THEN 1 END) as without_fish_count
FROM processing_records;

-- Step 5: Show detailed results for verification
SELECT 
    'Updated processing records details:' as info,
    pr.id,
    pr.processing_date,
    pr.post_processing_weight,
    pr.ready_for_dispatch_count,
    we.total_pieces as original_warehouse_pieces,
    we.total_weight as warehouse_weight,
    CASE 
        WHEN we.total_pieces IS NOT NULL AND we.total_pieces > 0 THEN 'From warehouse pieces'
        ELSE 'Estimated from weight (0.5kg avg)'
    END as source_method
FROM processing_records pr
LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
WHERE pr.ready_for_dispatch_count > 0
ORDER BY pr.processing_date DESC
LIMIT 15;

-- Step 6: Check which records are now ready for sorting
SELECT 
    'Records ready for sorting:' as status,
    COUNT(*) as count
FROM processing_records 
WHERE ready_for_dispatch_count > 0 
AND post_processing_weight > 0
AND NOT EXISTS (
    SELECT 1 FROM sorting_batches sb 
    WHERE sb.processing_record_id = processing_records.id 
    AND sb.status = 'completed'
);

-- Step 7: Show summary statistics
SELECT 
    'Processing records summary:' as summary,
    AVG(ready_for_dispatch_count) as avg_fish_count,
    MIN(ready_for_dispatch_count) as min_fish_count,
    MAX(ready_for_dispatch_count) as max_fish_count,
    SUM(ready_for_dispatch_count) as total_fish_count
FROM processing_records 
WHERE ready_for_dispatch_count > 0;

-- Step 8: Show warehouse entries analysis
SELECT 
    'Warehouse entries analysis:' as analysis,
    COUNT(*) as total_entries,
    COUNT(total_pieces) as entries_with_pieces,
    COUNT(*) - COUNT(total_pieces) as entries_without_pieces,
    AVG(total_pieces) as avg_pieces,
    AVG(total_weight) as avg_weight
FROM warehouse_entries;
