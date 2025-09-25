-- CHECK STORAGE 1 SIZE 2 DATA
-- This will show us the actual data for storage 1 size 2 to see if transfer information exists

SELECT '=== STORAGE 1 SIZE 2 INVENTORY DATA ===' as section;

-- Check what's in sorting_results for storage 1 size 2
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
    sr.updated_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'storage 1'
AND sr.size_class = 2
ORDER BY sr.created_at DESC;

-- Check the storage location ID for storage 1
SELECT '=== STORAGE LOCATION INFO ===' as section;
SELECT 
    id,
    name,
    location_type,
    status
FROM storage_locations 
WHERE name = 'storage 1';

-- Check if there are any transfers involving storage 1
SELECT '=== TRANSFERS INVOLVING STORAGE 1 ===' as section;
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
OR t.to_storage_name = 'storage 1'
ORDER BY t.created_at DESC;

-- Check all sorting_results for storage 1 to see what sizes exist
SELECT '=== ALL SIZES IN STORAGE 1 ===' as section;
SELECT 
    sr.size_class,
    SUM(sr.total_pieces) as total_pieces,
    SUM(sr.total_weight_grams) as total_weight_grams,
    COUNT(*) as batch_count
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'storage 1'
GROUP BY sr.size_class
ORDER BY sr.size_class;
