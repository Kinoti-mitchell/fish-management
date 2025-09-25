-- TEST INVENTORY SERVICE DATA
-- This will simulate what the inventory service should return for storage 1

SELECT '=== SIMULATING INVENTORY SERVICE QUERY ===' as section;

-- This is similar to what the inventory service does
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
    sl.name as storage_location_name,
    sb.batch_number,
    sb.created_at as batch_created_at,
    pr.processing_date,
    f.name as farmer_name,
    -- Check if this is a transferred batch
    CASE 
        WHEN sr.transfer_id IS NOT NULL AND sr.transfer_source_storage_name IS NOT NULL 
        THEN true 
        ELSE false 
    END as is_transferred,
    -- Show what the farmer_name field should display
    CASE 
        WHEN sr.transfer_id IS NOT NULL AND sr.transfer_source_storage_name IS NOT NULL 
        THEN f.name || ' (Transferred from ' || sr.transfer_source_storage_name || ')'
        ELSE f.name
    END as display_farmer_name
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
LEFT JOIN processing_records pr ON sb.processing_record_id = pr.id
LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
LEFT JOIN farmers f ON we.farmer_id = f.id
WHERE sl.name = 'storage 1'
AND sr.size_class = 2
ORDER BY sr.created_at DESC;
