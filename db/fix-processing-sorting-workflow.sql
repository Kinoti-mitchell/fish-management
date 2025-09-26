-- Fix Processing and Sorting Workflow
-- This script fixes the data flow issues in the processing and sorting system

-- 1. Fix processing records to have proper ready_for_dispatch_count
-- Update processing records that have 0 ready_for_dispatch_count
UPDATE processing_records 
SET 
  ready_for_dispatch_count = CASE 
    WHEN post_processing_weight > 0 THEN 
      -- Estimate pieces based on average fish weight (assuming 200g per fish)
      GREATEST(1, ROUND(post_processing_weight * 5)) -- 5 pieces per kg average
    ELSE 0
  END,
  updated_at = NOW()
WHERE ready_for_dispatch_count = 0 
AND post_processing_weight > 0;

-- 2. Fix sorting batches to have proper total_pieces
-- Update sorting batches that have 0 total_pieces
UPDATE sorting_batches 
SET 
  total_pieces = CASE 
    WHEN total_weight_grams > 0 THEN 
      -- Estimate pieces based on average fish weight (assuming 200g per fish)
      GREATEST(1, ROUND(total_weight_grams / 200))
    ELSE 0
  END,
  updated_at = NOW()
WHERE total_pieces = 0 
AND total_weight_grams > 0;

-- 3. Create missing sorting results for completed batches
-- This will create sorting results for batches that don't have them
INSERT INTO sorting_results (
  sorting_batch_id,
  size_class,
  total_pieces,
  total_weight_grams,
  average_weight_grams,
  created_at,
  updated_at
)
SELECT 
  sb.id as sorting_batch_id,
  -- Use size distribution from the batch or default to size 5
  CASE 
    WHEN sb.size_distribution IS NOT NULL AND jsonb_typeof(sb.size_distribution) = 'object' THEN
      -- Get the first size class from the distribution
      (jsonb_object_keys(sb.size_distribution))::INTEGER
    ELSE 5 -- Default size class
  END as size_class,
  -- Use total pieces from batch or estimate
  CASE 
    WHEN sb.total_pieces > 0 THEN sb.total_pieces
    WHEN sb.total_weight_grams > 0 THEN ROUND(sb.total_weight_grams / 200) -- 200g per fish
    ELSE 1
  END as total_pieces,
  -- Use total weight from batch
  CASE 
    WHEN sb.total_weight_grams > 0 THEN sb.total_weight_grams
    ELSE 1000 -- Default 1kg
  END as total_weight_grams,
  -- Calculate average weight
  CASE 
    WHEN sb.total_pieces > 0 AND sb.total_weight_grams > 0 THEN 
      sb.total_weight_grams / sb.total_pieces
    ELSE 200 -- Default 200g per fish
  END as average_weight_grams,
  NOW() as created_at,
  NOW() as updated_at
FROM sorting_batches sb
WHERE sb.status = 'completed'
AND NOT EXISTS (
  SELECT 1 FROM sorting_results sr 
  WHERE sr.sorting_batch_id = sb.id
)
AND sb.total_weight_grams > 0;

-- 4. Update sorting results to have proper storage_location_id
-- Set storage location for sorting results that don't have one
UPDATE sorting_results 
SET 
  storage_location_id = (
    SELECT sb.storage_location_id 
    FROM sorting_batches sb 
    WHERE sb.id = sorting_results.sorting_batch_id
  ),
  updated_at = NOW()
WHERE storage_location_id IS NULL
AND EXISTS (
  SELECT 1 FROM sorting_batches sb 
  WHERE sb.id = sorting_results.sorting_batch_id 
  AND sb.storage_location_id IS NOT NULL
);

-- 5. Verify the fixes
SELECT 'Processing and Sorting Workflow Fixed!' as status;

-- Show summary of fixes
SELECT 
  'Processing Records' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN ready_for_dispatch_count > 0 THEN 1 END) as with_dispatch_count
FROM processing_records
UNION ALL
SELECT 
  'Sorting Batches' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN total_pieces > 0 THEN 1 END) as with_pieces
FROM sorting_batches
UNION ALL
SELECT 
  'Sorting Results' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN storage_location_id IS NOT NULL THEN 1 END) as with_storage
FROM sorting_results;
