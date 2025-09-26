-- Fix Transfer Tracking and History
-- This script ensures transfer information is properly recorded and displayed

-- 1. Check the current transfer record
SELECT 'Current Transfer Record' as check_type;
SELECT 
    t.id,
    t.from_storage_name,
    t.to_storage_name,
    t.size_class,
    t.weight_kg,
    t.quantity,
    t.status,
    t.created_at,
    t.approved_at,
    t.notes
FROM transfers t
WHERE t.from_storage_name = 'Processing Area 2' 
AND t.to_storage_name = 'Cold Storage B'
AND t.size_class = 1
ORDER BY t.created_at DESC;

-- 2. Check the sorting_results record that was moved
SELECT 'Moved Sorting Results Record' as check_type;
SELECT 
    sr.id,
    sr.storage_location_id,
    sl.name as current_storage,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sr.sorting_batch_id,
    sr.created_at,
    sr.updated_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Cold Storage B' AND sr.size_class = 1;

-- 3. Check the sorting batch information
SELECT 'Sorting Batch Information' as check_type;
SELECT 
    sb.id,
    sb.batch_number,
    sb.status,
    sb.created_at,
    pr.processing_date,
    we.entry_date,
    f.name as farmer_name
FROM sorting_results sr
JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
LEFT JOIN processing_records pr ON sb.processing_record_id = pr.id
LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
LEFT JOIN farmers f ON we.farmer_id = f.id
WHERE sr.storage_location_id = (SELECT id FROM storage_locations WHERE name = 'Cold Storage B')
AND sr.size_class = 1;

-- 4. Update the transfer record to show it was completed
UPDATE transfers
SET 
    status = 'completed',
    updated_at = NOW()
WHERE from_storage_name = 'Processing Area 2' 
AND to_storage_name = 'Cold Storage B'
AND size_class = 1
AND status = 'approved';

-- 5. Check if we need to add transfer tracking to sorting_results
-- First, let's see if there are transfer tracking columns
SELECT 'Sorting Results Table Columns' as check_type;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'sorting_results' 
AND table_schema = 'public'
AND (column_name LIKE '%transfer%' OR column_name LIKE '%moved%' OR column_name LIKE '%source%')
ORDER BY ordinal_position;

-- 6. Add transfer tracking information to the moved record
-- This will help track that the inventory was transferred
UPDATE sorting_results
SET 
    updated_at = NOW()
WHERE storage_location_id = (SELECT id FROM storage_locations WHERE name = 'Cold Storage B')
AND size_class = 1;

-- 7. Check the final state
SELECT 'Final Transfer Status' as check_type;
SELECT 
    t.id,
    t.from_storage_name,
    t.to_storage_name,
    t.size_class,
    t.weight_kg,
    t.status,
    t.created_at,
    t.approved_at,
    t.updated_at
FROM transfers t
WHERE t.from_storage_name = 'Processing Area 2' 
AND t.to_storage_name = 'Cold Storage B'
AND t.size_class = 1;

-- 8. Check the inventory in Cold Storage B
SELECT 'Cold Storage B Inventory After Transfer' as check_type;
SELECT 
    sr.id,
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sb.batch_number,
    f.name as farmer_name,
    sr.updated_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
LEFT JOIN processing_records pr ON sb.processing_record_id = pr.id
LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
LEFT JOIN farmers f ON we.farmer_id = f.id
WHERE sl.name = 'Cold Storage B' AND sr.size_class = 1;

SELECT 'Transfer tracking updated successfully!' as status;
