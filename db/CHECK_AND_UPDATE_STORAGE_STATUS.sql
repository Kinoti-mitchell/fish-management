-- Check and Update Storage Status Script
-- This helps you manage storage location statuses

-- 1. Check current storage statuses
SELECT '=== CURRENT STORAGE STATUSES ===' as section;
SELECT 
    id,
    name,
    location_type,
    status,
    capacity_kg,
    current_usage_kg,
    ROUND((current_usage_kg / capacity_kg * 100), 2) as usage_percent,
    created_at,
    updated_at
FROM storage_locations
ORDER BY name;

-- 2. Check inventory in each storage location
SELECT '=== INVENTORY BY STORAGE LOCATION ===' as section;
SELECT 
    sl.name as storage_name,
    sl.status as storage_status,
    COUNT(sr.id) as inventory_items,
    SUM(sr.total_pieces) as total_pieces,
    ROUND(SUM(sr.total_weight_grams) / 1000.0, 2) as total_weight_kg,
    ROUND((SUM(sr.total_weight_grams) / 1000.0 / sl.capacity_kg * 100), 2) as usage_percent
FROM storage_locations sl
LEFT JOIN sorting_results sr ON sl.id = sr.storage_location_id
GROUP BY sl.id, sl.name, sl.status, sl.capacity_kg
ORDER BY sl.name;

-- 3. If you need to set Cold Storage A to inactive, uncomment and run this:
-- UPDATE storage_locations 
-- SET status = 'inactive', updated_at = NOW()
-- WHERE name = 'Cold Storage A';

-- 4. If you need to set Cold Storage A back to active, uncomment and run this:
-- UPDATE storage_locations 
-- SET status = 'active', updated_at = NOW()
-- WHERE name = 'Cold Storage A';

-- 5. Check what would be available for disposal after status change
SELECT '=== ITEMS AVAILABLE FOR DISPOSAL ===' as section;
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
ORDER BY 
    CASE disposal_reason 
        WHEN 'Storage Inactive' THEN 1
        WHEN 'Storage Maintenance' THEN 2
        WHEN 'Expired' THEN 3
        ELSE 4
    END,
    days_in_storage DESC;

