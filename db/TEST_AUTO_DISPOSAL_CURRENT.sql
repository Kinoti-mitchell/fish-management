-- Test Current Auto Disposal Functionality
-- This script tests the auto disposal system with the current data

-- 1. First, let's see what inventory items are available for disposal
SELECT '=== CURRENT INVENTORY FOR DISPOSAL ===' as section;
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
ORDER BY disposal_reason, days_in_storage DESC;

-- 2. Check for duplicate entries (as mentioned in the user query)
SELECT '=== CHECKING FOR DUPLICATES ===' as section;
SELECT 
    batch_number,
    storage_location_name,
    farmer_name,
    processing_date,
    days_in_storage,
    disposal_reason,
    COUNT(*) as duplicate_count,
    SUM(total_pieces) as total_pieces,
    ROUND(SUM(total_weight_grams) / 1000.0, 2) as total_weight_kg
FROM get_inventory_for_disposal(30, true)
GROUP BY batch_number, storage_location_name, farmer_name, processing_date, days_in_storage, disposal_reason
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 3. Test creating an auto disposal (dry run - we'll create a test disposal)
SELECT '=== TESTING AUTO DISPOSAL CREATION ===' as section;

-- First, let's see if we have any disposal reasons
SELECT 'Available disposal reasons:' as info;
SELECT id, name, description FROM disposal_reasons WHERE is_active = true ORDER BY name;

-- 4. Check if there are any existing disposal records that might be causing issues
SELECT '=== EXISTING DISPOSAL RECORDS ===' as section;
SELECT 
    dr.disposal_number,
    dr.status,
    dr.disposal_date,
    dr.total_weight_kg,
    dr.total_pieces,
    drr.name as reason_name,
    COUNT(di.id) as items_count
FROM disposal_records dr
LEFT JOIN disposal_reasons drr ON dr.disposal_reason_id = drr.id
LEFT JOIN disposal_items di ON dr.id = di.disposal_record_id
GROUP BY dr.id, dr.disposal_number, dr.status, dr.disposal_date, dr.total_weight_kg, dr.total_pieces, drr.name
ORDER BY dr.created_at DESC;

-- 5. Check for items that might be stuck in pending disposal records
SELECT '=== ITEMS IN PENDING DISPOSAL RECORDS ===' as section;
SELECT 
    dr.disposal_number,
    dr.status,
    di.batch_number,
    di.storage_location_name,
    di.farmer_name,
    di.quantity,
    di.weight_kg
FROM disposal_records dr
JOIN disposal_items di ON dr.id = di.disposal_record_id
WHERE dr.status IN ('pending', 'approved')
ORDER BY dr.created_at DESC;

-- 6. Summary of what needs to be disposed
SELECT '=== DISPOSAL SUMMARY ===' as section;
SELECT 
    disposal_reason,
    COUNT(*) as item_count,
    SUM(total_pieces) as total_pieces,
    ROUND(SUM(total_weight_grams) / 1000.0, 2) as total_weight_kg
FROM get_inventory_for_disposal(30, true)
GROUP BY disposal_reason
ORDER BY total_weight_kg DESC;
