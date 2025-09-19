-- Update Existing Processing Records with Fish Count from Warehouse Entries
-- This script pulls the number of fish from warehouse entries for already processed records

-- First, let's see what we're working with
SELECT 
    'Current processing records without fish count:' as status,
    COUNT(*) as count
FROM processing_records 
WHERE ready_for_dispatch_count IS NULL OR ready_for_dispatch_count = 0;

-- Update processing records with fish count from warehouse entries
UPDATE processing_records 
SET ready_for_dispatch_count = we.total_pieces
FROM warehouse_entries we
WHERE processing_records.warehouse_entry_id = we.id
AND (processing_records.ready_for_dispatch_count IS NULL OR processing_records.ready_for_dispatch_count = 0)
AND we.total_pieces IS NOT NULL;

-- For records where total_pieces is not available, use a reasonable estimate
-- based on weight (assuming average fish weight of 0.5kg)
UPDATE processing_records 
SET ready_for_dispatch_count = GREATEST(1, ROUND(post_processing_weight / 0.5))
WHERE ready_for_dispatch_count IS NULL OR ready_for_dispatch_count = 0;

-- Show the results
SELECT 
    'Updated processing records:' as status,
    COUNT(*) as count
FROM processing_records 
WHERE ready_for_dispatch_count > 0;

-- Show some examples of the updated records
SELECT 
    pr.id,
    pr.processing_date,
    pr.post_processing_weight,
    pr.ready_for_dispatch_count,
    we.total_pieces as warehouse_pieces,
    we.total_weight as warehouse_weight
FROM processing_records pr
LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
ORDER BY pr.processing_date DESC
LIMIT 10;

-- Verification query
SELECT 
    'Processing records ready for sorting:' as status,
    COUNT(*) as count
FROM processing_records 
WHERE ready_for_dispatch_count > 0 
AND post_processing_weight > 0;
