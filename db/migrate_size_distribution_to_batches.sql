-- Migrate size distribution data from processing_records to sorting_batches
-- This script copies existing size distribution data to the sorting_batches table
-- for batches that were created before the size_distribution column was added

-- First, let's see what data we have
SELECT 
    'Processing Records with Size Distribution' as source,
    COUNT(*) as count
FROM processing_records 
WHERE size_distribution IS NOT NULL 
AND size_distribution != '{}'::jsonb;

SELECT 
    'Sorting Batches without Size Distribution' as source,
    COUNT(*) as count
FROM sorting_batches 
WHERE size_distribution IS NULL 
OR size_distribution = '{}'::jsonb;

-- Update sorting_batches with size distribution from processing_records
UPDATE sorting_batches 
SET size_distribution = pr.size_distribution,
    updated_at = NOW()
FROM processing_records pr
WHERE sorting_batches.processing_record_id = pr.id
AND pr.size_distribution IS NOT NULL 
AND pr.size_distribution != '{}'::jsonb
AND (sorting_batches.size_distribution IS NULL 
     OR sorting_batches.size_distribution = '{}'::jsonb);

-- Show the results
SELECT 
    'Updated Sorting Batches' as result,
    COUNT(*) as count
FROM sorting_batches 
WHERE size_distribution IS NOT NULL 
AND size_distribution != '{}'::jsonb;

-- Show some examples of the migrated data
SELECT 
    sb.batch_number,
    sb.status,
    sb.size_distribution,
    pr.post_processing_weight,
    pr.ready_for_dispatch_count
FROM sorting_batches sb
JOIN processing_records pr ON sb.processing_record_id = pr.id
WHERE sb.size_distribution IS NOT NULL 
AND sb.size_distribution != '{}'::jsonb
ORDER BY sb.created_at DESC
LIMIT 5;
