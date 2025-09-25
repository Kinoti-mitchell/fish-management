-- CHECK THE SIZES THAT WERE ACTUALLY TRANSFERRED
-- This will show us the transfer information for sizes 3, 5, 9, 10

SELECT '=== TRANSFERRED SIZES IN STORAGE 1 ===' as section;

-- Check sizes 3, 5, 9, 10 which should have transfer information
SELECT 
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    sr.transfer_source_storage_id,
    sr.transfer_source_storage_name,
    sr.transfer_id,
    f.name as farmer_name,
    -- Show what the display should look like
    CASE 
        WHEN sr.transfer_id IS NOT NULL AND sr.transfer_source_storage_name IS NOT NULL 
        THEN f.name || ' (Transferred from ' || sr.transfer_source_storage_name || ')'
        ELSE f.name
    END as display_farmer_name,
    CASE 
        WHEN sr.transfer_id IS NOT NULL AND sr.transfer_source_storage_name IS NOT NULL 
        THEN true 
        ELSE false 
    END as is_transferred
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
LEFT JOIN processing_records pr ON sb.processing_record_id = pr.id
LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
LEFT JOIN farmers f ON we.farmer_id = f.id
WHERE sl.name = 'storage 1'
AND sr.size_class IN (3, 5, 9, 10)
ORDER BY sr.size_class;
