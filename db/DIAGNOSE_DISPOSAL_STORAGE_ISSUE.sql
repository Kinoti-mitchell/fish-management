-- Diagnostic Script for Disposal Storage Issue
-- This script helps identify why inactive cold storage items aren't showing in disposal

-- 1. Check current storage locations and their status
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

-- 2. Check inventory items in each storage location
SELECT '=== INVENTORY IN STORAGE LOCATIONS ===' as section;
SELECT 
    sl.name as storage_name,
    sl.status as storage_status,
    COUNT(sr.id) as inventory_items,
    SUM(sr.total_pieces) as total_pieces,
    ROUND(SUM(sr.total_weight_grams) / 1000.0, 2) as total_weight_kg
FROM storage_locations sl
LEFT JOIN sorting_results sr ON sl.id = sr.storage_location_id
GROUP BY sl.id, sl.name, sl.status
ORDER BY sl.name;

-- 3. Check what the disposal function would return
SELECT '=== DISPOSAL FUNCTION TEST (30 days, include storage issues) ===' as section;
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
ORDER BY days_in_storage DESC;

-- 4. Check specifically for inactive storage items
SELECT '=== ITEMS IN INACTIVE STORAGE ===' as section;
SELECT 
    sr.id as sorting_result_id,
    sl.name as storage_name,
    sl.status as storage_status,
    sb.batch_number,
    f.name as farmer_name,
    pr.processing_date,
    EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date)))::INTEGER as days_in_storage,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
JOIN processing_records pr ON sb.processing_record_id = pr.id
JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
JOIN farmers f ON we.farmer_id = f.id
WHERE sb.status = 'completed'
AND sr.storage_location_id IS NOT NULL
AND sr.total_pieces > 0
AND sl.status = 'inactive'
ORDER BY days_in_storage DESC;

-- 5. Check if there are any existing disposal records for these items
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

-- 6. Test the disposal function with different parameters
SELECT '=== DISPOSAL FUNCTION TEST (0 days, include storage issues) ===' as section;
SELECT 
    batch_number,
    storage_location_name,
    farmer_name,
    processing_date,
    days_in_storage,
    disposal_reason,
    total_pieces,
    ROUND(total_weight_grams / 1000.0, 2) as weight_kg
FROM get_inventory_for_disposal(0, true)
ORDER BY disposal_reason, days_in_storage DESC;

-- 7. Summary of the issue
SELECT '=== ISSUE SUMMARY ===' as section;
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM sorting_results sr
            JOIN storage_locations sl ON sr.storage_location_id = sl.id
            WHERE sl.status = 'inactive' AND sr.total_pieces > 0
        ) THEN 'ISSUE CONFIRMED: There are inventory items in inactive storage locations'
        ELSE 'NO ISSUE: No inventory items found in inactive storage locations'
    END as diagnosis;

