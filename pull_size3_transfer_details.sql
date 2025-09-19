-- PULL SIZE 3 TRANSFER DETAILS FROM STORAGE
-- This query will show all transfer information for Size 3 inventory

SELECT '=== SIZE 3 CURRENT INVENTORY STATUS ===' as section;

-- Current Size 3 inventory in storage 1
SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces as quantity,
    (sr.total_weight_grams / 1000.0) as weight_kg,
    ROUND((sr.total_weight_grams / 1000.0) / sr.total_pieces, 2) as avg_weight_per_fish,
    sr.storage_location_id,
    sl.name as storage_location,
    sr.sorting_batch_id,
    sr.transfer_source_storage_id,
    sr.transfer_source_storage_name,
    sr.transfer_id,
    sr.created_at as added_date,
    sr.updated_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'storage 1'
AND sr.size_class = 3;

SELECT '=== SIZE 3 BATCH INFORMATION ===' as section;

-- Get batch details for Size 3
SELECT 
    sb.id as batch_id,
    sb.batch_number,
    sb.created_at as batch_created_at,
    sb.status as batch_status,
    pr.processing_date,
    we.farmer_id,
    f.name as farmer_name,
    sr.size_class,
    sr.total_pieces,
    (sr.total_weight_grams / 1000.0) as weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
LEFT JOIN processing_records pr ON sb.processing_record_id = pr.id
LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
LEFT JOIN farmers f ON we.farmer_id = f.id
WHERE sl.name = 'storage 1'
AND sr.size_class = 3;

SELECT '=== SIZE 3 TRANSFER HISTORY ===' as section;

-- All transfers involving Size 3 (both incoming and outgoing)
SELECT 
    t.id as transfer_id,
    t.from_storage_name,
    t.to_storage_name,
    t.size_class,
    t.quantity,
    t.weight_kg,
    t.status,
    t.notes,
    t.requested_by,
    t.approved_by,
    t.approved_at,
    t.completed_at,
    t.created_at as transfer_created_at,
    -- Show if this transfer affected storage 1
    CASE 
        WHEN t.to_storage_name = 'storage 1' THEN 'INCOMING to storage 1'
        WHEN t.from_storage_name = 'storage 1' THEN 'OUTGOING from storage 1'
        ELSE 'OTHER'
    END as transfer_direction
FROM transfers t
WHERE t.size_class = 3
AND (t.from_storage_name = 'storage 1' OR t.to_storage_name = 'storage 1')
ORDER BY t.created_at DESC;

SELECT '=== SIZE 3 COMPLETED TRANSFERS TO STORAGE 1 ===' as section;

-- Specifically completed transfers that moved Size 3 TO storage 1
SELECT 
    t.id as transfer_id,
    t.from_storage_name as source_storage,
    t.to_storage_name as destination_storage,
    t.size_class,
    t.quantity as transferred_quantity,
    t.weight_kg as transferred_weight,
    t.status,
    t.notes,
    t.approved_at,
    t.completed_at,
    t.created_at as transfer_date,
    -- Calculate days since transfer
    EXTRACT(DAYS FROM (NOW() - t.completed_at)) as days_since_transfer
FROM transfers t
WHERE t.to_storage_name = 'storage 1'
AND t.size_class = 3
AND t.status = 'completed'
ORDER BY t.completed_at DESC;

SELECT '=== SIZE 3 PENDING TRANSFERS ===' as section;

-- Any pending transfers for Size 3
SELECT 
    t.id as transfer_id,
    t.from_storage_name,
    t.to_storage_name,
    t.size_class,
    t.quantity,
    t.weight_kg,
    t.status,
    t.notes,
    t.created_at as request_date,
    EXTRACT(DAYS FROM (NOW() - t.created_at)) as days_pending
FROM transfers t
WHERE t.size_class = 3
AND t.status = 'pending'
ORDER BY t.created_at DESC;

SELECT '=== SIZE 3 TRANSFER SUMMARY ===' as section;

-- Summary of all Size 3 transfer activity
SELECT 
    'Total Transfers' as metric,
    COUNT(*) as count,
    SUM(t.weight_kg) as total_weight_kg,
    SUM(t.quantity) as total_quantity
FROM transfers t
WHERE t.size_class = 3
AND (t.from_storage_name = 'storage 1' OR t.to_storage_name = 'storage 1')

UNION ALL

SELECT 
    'Completed Transfers to Storage 1' as metric,
    COUNT(*) as count,
    SUM(t.weight_kg) as total_weight_kg,
    SUM(t.quantity) as total_quantity
FROM transfers t
WHERE t.size_class = 3
AND t.to_storage_name = 'storage 1'
AND t.status = 'completed'

UNION ALL

SELECT 
    'Pending Transfers' as metric,
    COUNT(*) as count,
    SUM(t.weight_kg) as total_weight_kg,
    SUM(t.quantity) as total_quantity
FROM transfers t
WHERE t.size_class = 3
AND t.status = 'pending';

SELECT '=== SIZE 3 INVENTORY SOURCE ANALYSIS ===' as section;

-- Analyze the source of Size 3 inventory in storage 1
SELECT 
    CASE 
        WHEN sr.transfer_source_storage_name IS NOT NULL THEN 
            'Transferred from: ' || sr.transfer_source_storage_name
        ELSE 'Direct from processing (no transfer)'
    END as inventory_source,
    COUNT(*) as record_count,
    SUM(sr.total_pieces) as total_pieces,
    SUM(sr.total_weight_grams) / 1000.0 as total_weight_kg,
    MIN(sr.created_at) as earliest_date,
    MAX(sr.created_at) as latest_date
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'storage 1'
AND sr.size_class = 3
GROUP BY 
    CASE 
        WHEN sr.transfer_source_storage_name IS NOT NULL THEN 
            'Transferred from: ' || sr.transfer_source_storage_name
        ELSE 'Direct from processing (no transfer)'
    END
ORDER BY total_weight_kg DESC;
