-- Smart Processing Records Update (Handles Mixed Fish Types)
-- This script provides multiple estimation strategies for different scenarios

-- Step 1: Check current state and available data
SELECT 
    'BEFORE UPDATE - Current state analysis:' as phase,
    COUNT(*) as total_processing_records,
    COUNT(CASE WHEN ready_for_dispatch_count > 0 THEN 1 END) as with_fish_count,
    COUNT(CASE WHEN ready_for_dispatch_count IS NULL OR ready_for_dispatch_count = 0 THEN 1 END) as without_fish_count
FROM processing_records;

-- Step 2: Check warehouse entries data quality
SELECT 
    'Warehouse entries data quality:' as analysis,
    COUNT(*) as total_entries,
    COUNT(total_pieces) as entries_with_pieces,
    COUNT(*) - COUNT(total_pieces) as entries_without_pieces,
    AVG(total_pieces) as avg_pieces,
    AVG(total_weight) as avg_weight,
    MIN(total_weight) as min_weight,
    MAX(total_weight) as max_weight
FROM warehouse_entries;

-- Step 3: Strategy 1 - Use warehouse pieces where available (MOST ACCURATE)
UPDATE processing_records 
SET 
    ready_for_dispatch_count = we.total_pieces,
    updated_at = NOW()
FROM warehouse_entries we
WHERE processing_records.warehouse_entry_id = we.id
AND (processing_records.ready_for_dispatch_count IS NULL OR processing_records.ready_for_dispatch_count = 0)
AND we.total_pieces IS NOT NULL
AND we.total_pieces > 0;

-- Step 4: Strategy 2 - For records without pieces, use weight-based estimation
-- We'll use different averages based on weight ranges to handle mixed fish types

-- For small batches (likely single species or small fish)
UPDATE processing_records 
SET 
    ready_for_dispatch_count = GREATEST(1, ROUND(post_processing_weight / 0.3)), -- 300g average
    updated_at = NOW()
WHERE ready_for_dispatch_count IS NULL OR ready_for_dispatch_count = 0
AND post_processing_weight <= 50; -- Small batches

-- For medium batches (likely mixed or medium fish)
UPDATE processing_records 
SET 
    ready_for_dispatch_count = GREATEST(1, ROUND(post_processing_weight / 0.5)), -- 500g average
    updated_at = NOW()
WHERE ready_for_dispatch_count IS NULL OR ready_for_dispatch_count = 0
AND post_processing_weight > 50 AND post_processing_weight <= 200; -- Medium batches

-- For large batches (likely large fish or many fish)
UPDATE processing_records 
SET 
    ready_for_dispatch_count = GREATEST(1, ROUND(post_processing_weight / 0.7)), -- 700g average
    updated_at = NOW()
WHERE ready_for_dispatch_count IS NULL OR ready_for_dispatch_count = 0
AND post_processing_weight > 200; -- Large batches

-- Step 5: Show results by strategy
SELECT 
    'AFTER UPDATE - Results by strategy:' as phase,
    'Strategy 1: From warehouse pieces' as method,
    COUNT(*) as records_updated
FROM processing_records 
WHERE ready_for_dispatch_count > 0
AND EXISTS (
    SELECT 1 FROM warehouse_entries we 
    WHERE we.id = processing_records.warehouse_entry_id 
    AND we.total_pieces IS NOT NULL 
    AND we.total_pieces > 0
);

SELECT 
    'Strategy 2: Small batch estimation (0.3kg avg)' as method,
    COUNT(*) as records_updated
FROM processing_records 
WHERE ready_for_dispatch_count > 0
AND post_processing_weight <= 50
AND NOT EXISTS (
    SELECT 1 FROM warehouse_entries we 
    WHERE we.id = processing_records.warehouse_entry_id 
    AND we.total_pieces IS NOT NULL 
    AND we.total_pieces > 0
);

SELECT 
    'Strategy 3: Medium batch estimation (0.5kg avg)' as method,
    COUNT(*) as records_updated
FROM processing_records 
WHERE ready_for_dispatch_count > 0
AND post_processing_weight > 50 AND post_processing_weight <= 200
AND NOT EXISTS (
    SELECT 1 FROM warehouse_entries we 
    WHERE we.id = processing_records.warehouse_entry_id 
    AND we.total_pieces IS NOT NULL 
    AND we.total_pieces > 0
);

SELECT 
    'Strategy 4: Large batch estimation (0.7kg avg)' as method,
    COUNT(*) as records_updated
FROM processing_records 
WHERE ready_for_dispatch_count > 0
AND post_processing_weight > 200
AND NOT EXISTS (
    SELECT 1 FROM warehouse_entries we 
    WHERE we.id = processing_records.warehouse_entry_id 
    AND we.total_pieces IS NOT NULL 
    AND we.total_pieces > 0
);

-- Step 6: Show detailed results for verification
SELECT 
    'Updated processing records details:' as info,
    pr.id,
    pr.processing_date,
    pr.post_processing_weight,
    pr.ready_for_dispatch_count,
    we.total_pieces as original_warehouse_pieces,
    we.total_weight as warehouse_weight,
    CASE 
        WHEN we.total_pieces IS NOT NULL AND we.total_pieces > 0 THEN 'From warehouse pieces (MOST ACCURATE)'
        WHEN pr.post_processing_weight <= 50 THEN 'Small batch estimation (0.3kg avg)'
        WHEN pr.post_processing_weight <= 200 THEN 'Medium batch estimation (0.5kg avg)'
        ELSE 'Large batch estimation (0.7kg avg)'
    END as estimation_method,
    ROUND(pr.post_processing_weight / pr.ready_for_dispatch_count, 2) as calculated_avg_weight_per_fish
FROM processing_records pr
LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
WHERE pr.ready_for_dispatch_count > 0
ORDER BY pr.processing_date DESC
LIMIT 20;

-- Step 7: Show summary statistics
SELECT 
    'Final processing records summary:' as summary,
    COUNT(*) as total_records,
    COUNT(CASE WHEN ready_for_dispatch_count > 0 THEN 1 END) as records_with_fish_count,
    AVG(ready_for_dispatch_count) as avg_fish_count,
    MIN(ready_for_dispatch_count) as min_fish_count,
    MAX(ready_for_dispatch_count) as max_fish_count,
    SUM(ready_for_dispatch_count) as total_fish_count,
    AVG(post_processing_weight / ready_for_dispatch_count) as avg_weight_per_fish
FROM processing_records 
WHERE ready_for_dispatch_count > 0;

-- Step 8: Show records ready for sorting
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

-- Step 9: Recommendations for future improvements
SELECT 
    'RECOMMENDATIONS FOR MIXED FISH TYPES:' as recommendations,
    '1. Add fish_type column to warehouse_entries table' as rec1,
    '2. Track fish species during warehouse entry' as rec2,
    '3. Use species-specific average weights for estimation' as rec3,
    '4. Consider separate processing records for different fish types' as rec4;
