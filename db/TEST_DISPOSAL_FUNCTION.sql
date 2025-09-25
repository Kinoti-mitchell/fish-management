-- Test Script for get_inventory_for_disposal Function
-- Run this to verify the function works correctly

-- Test 1: Call function with default parameters
SELECT '=== TEST 1: Default Parameters ===' as test;
SELECT 
    COUNT(*) as total_items,
    COUNT(CASE WHEN disposal_reason = 'Storage Inactive' THEN 1 END) as inactive_storage_items,
    COUNT(CASE WHEN disposal_reason = 'Storage Maintenance' THEN 1 END) as maintenance_storage_items,
    COUNT(CASE WHEN disposal_reason = 'Expired' THEN 1 END) as expired_items,
    COUNT(CASE WHEN disposal_reason = 'Storage Overcapacity' THEN 1 END) as overcapacity_items
FROM get_inventory_for_disposal();

-- Test 2: Call function with explicit parameters (same as frontend)
SELECT '=== TEST 2: Explicit Parameters (30 days, include storage issues) ===' as test;
SELECT 
    COUNT(*) as total_items,
    COUNT(CASE WHEN disposal_reason = 'Storage Inactive' THEN 1 END) as inactive_storage_items,
    COUNT(CASE WHEN disposal_reason = 'Storage Maintenance' THEN 1 END) as maintenance_storage_items,
    COUNT(CASE WHEN disposal_reason = 'Expired' THEN 1 END) as expired_items,
    COUNT(CASE WHEN disposal_reason = 'Storage Overcapacity' THEN 1 END) as overcapacity_items
FROM get_inventory_for_disposal(30, true);

-- Test 3: Show actual items (limit to 10)
SELECT '=== TEST 3: Sample Items for Disposal ===' as test;
SELECT 
    batch_number,
    storage_location_name,
    farmer_name,
    processing_date,
    days_in_storage,
    disposal_reason,
    total_pieces,
    ROUND(total_weight_grams / 1000.0, 2) as weight_kg,
    quality_notes
FROM get_inventory_for_disposal(30, true)
ORDER BY 
    CASE disposal_reason 
        WHEN 'Storage Inactive' THEN 1
        WHEN 'Storage Maintenance' THEN 2
        WHEN 'Expired' THEN 3
        ELSE 4
    END,
    days_in_storage DESC
LIMIT 10;

-- Test 4: Check for items in inactive storage specifically
SELECT '=== TEST 4: Items in Inactive Storage ===' as test;
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
WHERE disposal_reason = 'Storage Inactive'
ORDER BY days_in_storage DESC;

-- Test 5: Check function signature
SELECT '=== TEST 5: Function Signature ===' as test;
SELECT 
    routine_name,
    parameter_name,
    parameter_mode,
    data_type,
    parameter_default
FROM information_schema.parameters p
JOIN information_schema.routines r ON p.specific_name = r.specific_name
WHERE r.routine_schema = 'public' 
AND r.routine_name = 'get_inventory_for_disposal'
ORDER BY p.ordinal_position;

