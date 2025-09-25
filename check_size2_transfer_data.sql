-- CHECK SIZE 2 TRANSFER DATA SPECIFICALLY
-- This will show us the detailed data for size 2 in storage 1

SELECT '=== SIZE 2 DETAILED DATA ===' as section;

-- Get detailed information for size 2 in storage 1
SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    sr.storage_location_id,
    sr.sorting_batch_id,
    sr.transfer_source_storage_id,
    sr.transfer_source_storage_name,
    sr.transfer_id,
    sr.created_at,
    sr.updated_at,
    -- Get batch information
    sb.batch_number,
    sb.created_at as batch_created_at,
    -- Get processing information
    pr.processing_date,
    -- Get farmer information
    we.farmer_id,
    f.name as farmer_name,
    f.phone as farmer_phone,
    f.location as farmer_location
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
LEFT JOIN processing_records pr ON sb.processing_record_id = pr.id
LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
LEFT JOIN farmers f ON we.farmer_id = f.id
WHERE sl.name = 'storage 1'
AND sr.size_class = 2;

-- Check if there are any transfers that moved size 2 to storage 1
SELECT '=== TRANSFERS FOR SIZE 2 TO STORAGE 1 ===' as section;
SELECT 
    t.id,
    t.from_storage_name,
    t.to_storage_name,
    t.size_class,
    t.weight_kg,
    t.quantity,
    t.status,
    t.created_at,
    t.notes
FROM transfers t
WHERE t.to_storage_name = 'storage 1'
AND t.size_class = 2
ORDER BY t.created_at DESC;

-- Check if there are any transfers that moved size 2 from storage 1
SELECT '=== TRANSFERS FOR SIZE 2 FROM STORAGE 1 ===' as section;
SELECT 
    t.id,
    t.from_storage_name,
    t.to_storage_name,
    t.size_class,
    t.weight_kg,
    t.quantity,
    t.status,
    t.created_at,
    t.notes
FROM transfers t
WHERE t.from_storage_name = 'storage 1'
AND t.size_class = 2
ORDER BY t.created_at DESC;
