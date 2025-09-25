-- Fix Processor 1 Inventory Issue
-- This script will help diagnose and fix the Processor 1 inventory problem

-- 1. Check what storage locations exist
SELECT '=== Storage Locations ===' as info;
SELECT 
    id,
    name,
    location_type,
    capacity_kg,
    current_usage_kg,
    status,
    created_at
FROM storage_locations 
ORDER BY name;

-- 2. Check for processor-related locations
SELECT '=== Processor-Related Locations ===' as info;
SELECT 
    id,
    name,
    location_type,
    capacity_kg,
    current_usage_kg,
    status
FROM storage_locations 
WHERE name ILIKE '%processor%' 
   OR name ILIKE '%processing%'
ORDER BY name;

-- 3. Check sorting results with storage locations
SELECT '=== Sorting Results by Storage Location ===' as info;
SELECT 
    sr.storage_location_id,
    sl.name as storage_location_name,
    COUNT(*) as result_count,
    SUM(sr.total_pieces) as total_pieces,
    SUM(sr.total_weight_grams) / 1000.0 as total_weight_kg,
    STRING_AGG(DISTINCT sr.size_class::text, ', ') as size_classes
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sr.storage_location_id IS NOT NULL
GROUP BY sr.storage_location_id, sl.name
ORDER BY sl.name;

-- 4. Check sorting results without storage location (these might be your missing fish)
SELECT '=== Sorting Results WITHOUT Storage Location ===' as info;
SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams / 1000.0 as total_weight_kg,
    sr.sorting_batch_id,
    sb.batch_number,
    sr.created_at
FROM sorting_results sr
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
WHERE sr.storage_location_id IS NULL
ORDER BY sr.created_at DESC;

-- 5. If you need to create a "Processor 1" location, uncomment and run this:
/*
INSERT INTO storage_locations (name, description, location_type, capacity_kg, temperature_celsius, humidity_percent, status) 
VALUES ('Processor 1', 'Main fish processing unit', 'processing_area', 1000.00, 15.00, 70.00, 'active')
ON CONFLICT (name) DO NOTHING;
*/

-- 6. If you have fish without storage locations and want to assign them to "Processing Area 1", uncomment and run this:
/*
UPDATE sorting_results 
SET storage_location_id = (SELECT id FROM storage_locations WHERE name = 'Processing Area 1' LIMIT 1)
WHERE storage_location_id IS NULL;
*/

-- 7. Verify the fix
SELECT '=== Verification: Updated Inventory ===' as info;
SELECT 
    sl.name as storage_location,
    COUNT(sr.id) as result_count,
    SUM(sr.total_pieces) as total_pieces,
    SUM(sr.total_weight_grams) / 1000.0 as total_weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
GROUP BY sl.name
ORDER BY sl.name;
