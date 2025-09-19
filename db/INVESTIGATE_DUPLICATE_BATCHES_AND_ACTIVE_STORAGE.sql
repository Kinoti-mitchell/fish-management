-- Investigate Duplicate Batch Numbers and Active Storage in Disposal
-- This script helps identify why batch numbers are duplicated and why active storage appears in disposal

-- 1. Check for duplicate batch numbers in sorting_batches
SELECT '=== DUPLICATE BATCH NUMBERS ===' as section;
SELECT 
    batch_number,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ') as batch_ids,
    STRING_AGG(status, ', ') as statuses,
    STRING_AGG(created_at::text, ', ') as created_dates
FROM sorting_batches
WHERE batch_number IS NOT NULL
GROUP BY batch_number
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. Check all batch numbers and their details
SELECT '=== ALL BATCH NUMBERS ===' as section;
SELECT 
    id,
    batch_number,
    status,
    created_at,
    processing_record_id
FROM sorting_batches
ORDER BY batch_number, created_at;

-- 3. Check storage locations and their current status
SELECT '=== STORAGE LOCATIONS STATUS ===' as section;
SELECT 
    id,
    name,
    location_type,
    status,
    capacity_kg,
    current_usage_kg,
    created_at,
    updated_at
FROM storage_locations
ORDER BY name;

-- 4. Check inventory in each storage location
SELECT '=== INVENTORY BY STORAGE LOCATION ===' as section;
SELECT 
    sl.name as storage_name,
    sl.status as storage_status,
    COUNT(sr.id) as inventory_items,
    SUM(sr.total_pieces) as total_pieces,
    ROUND(SUM(sr.total_weight_grams) / 1000.0, 2) as total_weight_kg,
    STRING_AGG(DISTINCT sb.batch_number, ', ') as batch_numbers
FROM storage_locations sl
LEFT JOIN sorting_results sr ON sl.id = sr.storage_location_id
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
GROUP BY sl.id, sl.name, sl.status
ORDER BY sl.name;

-- 5. Check what the disposal function returns
SELECT '=== DISPOSAL FUNCTION RESULTS ===' as section;
SELECT 
    batch_number,
    storage_location_name,
    farmer_name,
    processing_date,
    days_in_storage,
    disposal_reason,
    total_pieces,
    ROUND(total_weight_grams / 1000.0, 2) as weight_kg
FROM get_inventory_for_disposal(30, true)
ORDER BY storage_location_name, batch_number;

-- 6. Check specifically for items in Cold Storage B (should be active)
SELECT '=== ITEMS IN COLD STORAGE B ===' as section;
SELECT 
    sr.id as sorting_result_id,
    sl.name as storage_name,
    sl.status as storage_status,
    sb.batch_number,
    f.name as farmer_name,
    pr.processing_date,
    EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date)))::INTEGER as days_in_storage,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    CASE 
        WHEN EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= 30 THEN 'Expired'
        WHEN sl.status = 'inactive' THEN 'Storage Inactive'
        WHEN sl.status = 'maintenance' THEN 'Storage Maintenance'
        WHEN sl.current_usage_kg > sl.capacity_kg THEN 'Storage Overcapacity'
        ELSE 'Should NOT be in disposal'
    END as why_in_disposal
FROM sorting_results sr
JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
JOIN processing_records pr ON sb.processing_record_id = pr.id
JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
JOIN farmers f ON we.farmer_id = f.id
WHERE sb.status = 'completed'
AND sr.storage_location_id IS NOT NULL
AND sr.total_pieces > 0
AND sl.name = 'Cold Storage B'
ORDER BY days_in_storage DESC;

-- 7. Check for items that should NOT be in disposal (active storage, not expired)
SELECT '=== ITEMS THAT SHOULD NOT BE IN DISPOSAL ===' as section;
SELECT 
    batch_number,
    storage_location_name,
    farmer_name,
    processing_date,
    days_in_storage,
    disposal_reason,
    total_pieces,
    ROUND(total_weight_grams / 1000.0, 2) as weight_kg
FROM get_inventory_for_disposal(30, true)
WHERE disposal_reason NOT IN ('Expired', 'Storage Inactive', 'Storage Maintenance', 'Storage Overcapacity')
ORDER BY storage_location_name, batch_number;

-- 8. Check if there are any existing disposal records that might be causing issues
SELECT '=== EXISTING DISPOSAL RECORDS ===' as section;
SELECT 
    dr.disposal_number,
    dr.status as disposal_status,
    dr.disposal_date,
    COUNT(di.id) as items_count,
    SUM(di.quantity) as total_pieces,
    ROUND(SUM(di.weight_kg), 2) as total_weight_kg
FROM disposal_records dr
LEFT JOIN disposal_items di ON dr.id = di.disposal_record_id
GROUP BY dr.id, dr.disposal_number, dr.status, dr.disposal_date
ORDER BY dr.disposal_date DESC;

-- 9. Summary of issues
SELECT '=== ISSUE SUMMARY ===' as section;
SELECT 
    'Duplicate batch numbers found: ' || COUNT(*) as duplicate_batches
FROM (
    SELECT batch_number
    FROM sorting_batches
    WHERE batch_number IS NOT NULL
    GROUP BY batch_number
    HAVING COUNT(*) > 1
) duplicates

UNION ALL

SELECT 
    'Active storage items in disposal: ' || COUNT(*) as active_in_disposal
FROM get_inventory_for_disposal(30, true) g
JOIN storage_locations sl ON g.storage_location_name = sl.name
WHERE sl.status = 'active' 
AND g.disposal_reason NOT IN ('Expired', 'Storage Overcapacity');
