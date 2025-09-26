-- Check Batch 0040 Sorting Results and Inventory Updates
-- This script specifically examines batch 0040 to see if inventory is being updated after sorting

-- 1. Check if batch 0040 exists in sorting_batches
SELECT '=== BATCH 0040 IN SORTING_BATCHES ===' as section;

SELECT 
    id,
    batch_number,
    sorting_date,
    status,
    total_weight_kg,
    size_distribution,
    created_at,
    updated_at
FROM sorting_batches 
WHERE batch_number = '0040'
ORDER BY created_at DESC;

-- 2. Check sorting results for batch 0040
SELECT '=== SORTING RESULTS FOR BATCH 0040 ===' as section;

SELECT 
    sr.id,
    sr.sorting_batch_id,
    sb.batch_number,
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sr.created_at,
    sr.updated_at,
    CASE 
        WHEN sr.updated_at > sr.created_at THEN 'UPDATED'
        ELSE 'ORIGINAL'
    END as record_status
FROM sorting_results sr
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sb.batch_number = '0040'
ORDER BY sr.size_class, sl.name;

-- 3. Check if batch 0040 has been added to inventory_entries
SELECT '=== INVENTORY ENTRIES FOR BATCH 0040 ===' as section;

SELECT 
    ie.id,
    ie.size,
    ie.quantity,
    ie.quantity_change,
    ie.entry_type,
    ie.reference_id,
    ie.notes,
    ie.created_at,
    ie.updated_at
FROM inventory_entries ie
WHERE ie.reference_id IN (
    SELECT id FROM sorting_batches WHERE batch_number = '0040'
)
ORDER BY ie.size, ie.created_at;

-- 4. Check current inventory levels by size (from sorting_results)
SELECT '=== CURRENT INVENTORY BY SIZE (FROM SORTING RESULTS) ===' as section;

SELECT 
    sr.size_class,
    COUNT(*) as storage_locations,
    SUM(sr.total_pieces) as total_pieces,
    SUM(sr.total_weight_grams) as total_weight_grams,
    ROUND(SUM(sr.total_weight_grams) / 1000.0, 2) as total_weight_kg
FROM sorting_results sr
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
WHERE sb.batch_number = '0040'
GROUP BY sr.size_class
ORDER BY sr.size_class;

-- 5. Check if there are any transfers involving batch 0040
SELECT '=== TRANSFERS INVOLVING BATCH 0040 ===' as section;

SELECT 
    t.id,
    t.batch_number,
    t.status,
    t.from_storage_location_id,
    t.to_storage_location_id,
    t.size_class,
    t.quantity,
    t.weight_kg,
    t.created_at,
    t.updated_at
FROM transfers t
WHERE t.batch_number = '0040'
ORDER BY t.created_at DESC;

-- 6. Check inventory movement for batch 0040
SELECT '=== INVENTORY MOVEMENT FOR BATCH 0040 ===' as section;

SELECT 
    im.id,
    im.transfer_id,
    im.size_class,
    im.quantity_moved,
    im.weight_moved_kg,
    im.from_storage_location_id,
    im.to_storage_location_id,
    im.created_at
FROM inventory_movement im
WHERE im.transfer_id IN (
    SELECT id FROM transfers WHERE batch_number = '0040'
)
ORDER BY im.created_at DESC;

-- 7. Check if batch 0040 sorting results have been updated recently
SELECT '=== RECENT UPDATES TO BATCH 0040 SORTING RESULTS ===' as section;

SELECT 
    sr.id,
    sb.batch_number,
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sr.created_at,
    sr.updated_at,
    EXTRACT(EPOCH FROM (sr.updated_at - sr.created_at)) as seconds_since_creation,
    CASE 
        WHEN sr.updated_at > sr.created_at THEN 'HAS BEEN UPDATED'
        ELSE 'NO UPDATES'
    END as update_status
FROM sorting_results sr
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sb.batch_number = '0040'
ORDER BY sr.updated_at DESC;

-- 8. Summary of batch 0040 status
SELECT '=== BATCH 0040 SUMMARY ===' as section;

SELECT 
    'Batch 0040 Status' as item,
    CASE 
        WHEN EXISTS (SELECT 1 FROM sorting_batches WHERE batch_number = '0040') THEN 'EXISTS'
        ELSE 'NOT FOUND'
    END as status
UNION ALL
SELECT 
    'Sorting Results Count' as item,
    COUNT(*)::TEXT as status
FROM sorting_results sr
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
WHERE sb.batch_number = '0040'
UNION ALL
SELECT 
    'Total Pieces' as item,
    COALESCE(SUM(sr.total_pieces), 0)::TEXT as status
FROM sorting_results sr
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
WHERE sb.batch_number = '0040'
UNION ALL
SELECT 
    'Total Weight (kg)' as item,
    ROUND(COALESCE(SUM(sr.total_weight_grams), 0) / 1000.0, 2)::TEXT as status
FROM sorting_results sr
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
WHERE sb.batch_number = '0040'
UNION ALL
SELECT 
    'Has Inventory Entries' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM inventory_entries ie
            WHERE ie.reference_id IN (
                SELECT id FROM sorting_batches WHERE batch_number = '0040'
            )
        ) THEN 'YES'
        ELSE 'NO'
    END as status
UNION ALL
SELECT 
    'Has Transfers' as item,
    CASE 
        WHEN EXISTS (SELECT 1 FROM transfers WHERE batch_number = '0040') THEN 'YES'
        ELSE 'NO'
    END as status;

SELECT 'Batch 0040 check completed!' as status;
