-- Fix Inventory Data Issues
-- This script cleans up invalid inventory items and fixes data integrity issues

-- 1. Check for invalid inventory items
SELECT '=== CHECKING INVALID INVENTORY ITEMS ===' as status;

SELECT 
    'Invalid items found' as check_type,
    COUNT(*) as count
FROM sorting_results 
WHERE size_class IS NULL 
   OR total_pieces <= 0 
   OR total_weight_grams <= 0
   OR storage_location_id IS NULL;

-- 2. Show invalid items for review
SELECT 
    'Invalid inventory items:' as check_type,
    id,
    size_class,
    total_pieces,
    total_weight_grams,
    storage_location_id
FROM sorting_results 
WHERE size_class IS NULL 
   OR total_pieces <= 0 
   OR total_weight_grams <= 0
   OR storage_location_id IS NULL
LIMIT 10;

-- 3. Fix invalid size_class (set to 0 if NULL)
UPDATE sorting_results 
SET size_class = 0 
WHERE size_class IS NULL 
  AND total_weight_grams > 0;

-- 4. Remove items with zero or negative quantities
DELETE FROM sorting_results 
WHERE total_pieces <= 0 
   OR total_weight_grams <= 0;

-- 5. Fix items without storage location (assign to a default location)
-- First, get a default storage location
DO $$
DECLARE
    default_storage_id UUID;
BEGIN
    -- Get the first available storage location
    SELECT id INTO default_storage_id 
    FROM storage_locations 
    WHERE status = 'active' 
    ORDER BY name 
    LIMIT 1;
    
    -- Update items without storage location
    IF default_storage_id IS NOT NULL THEN
        UPDATE sorting_results 
        SET storage_location_id = default_storage_id
        WHERE storage_location_id IS NULL;
        
        RAISE NOTICE 'Updated items without storage location to: %', default_storage_id;
    ELSE
        RAISE NOTICE 'No active storage locations found';
    END IF;
END $$;

-- 6. Check storage capacity issues
SELECT '=== CHECKING STORAGE CAPACITY ISSUES ===' as status;

SELECT 
    sl.name,
    sl.capacity_kg,
    sl.current_usage_kg,
    (sl.current_usage_kg - sl.capacity_kg) as overage_kg,
    CASE 
        WHEN sl.current_usage_kg > sl.capacity_kg THEN 'OVER CAPACITY'
        WHEN sl.current_usage_kg / sl.capacity_kg > 0.9 THEN 'NEAR CAPACITY'
        ELSE 'OK'
    END as status
FROM storage_locations sl
WHERE sl.capacity_kg > 0
ORDER BY (sl.current_usage_kg / sl.capacity_kg) DESC;

-- 7. Update storage capacity after cleanup
SELECT '=== UPDATING STORAGE CAPACITY ===' as status;

-- Drop and recreate the function to fix the WHERE clause issue
DROP FUNCTION IF EXISTS update_storage_capacity_from_inventory() CASCADE;

CREATE OR REPLACE FUNCTION update_storage_capacity_from_inventory()
RETURNS VOID AS $$
BEGIN
    -- Update current_usage_kg for all storage locations
    UPDATE storage_locations 
    SET current_usage_kg = (
        SELECT COALESCE(SUM(total_weight_grams) / 1000.0, 0)
        FROM sorting_results sr
        WHERE sr.storage_location_id = storage_locations.id
    ),
    updated_at = NOW();
    
    RAISE NOTICE 'Storage capacity updated for all locations';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_storage_capacity_from_inventory() TO authenticated;
GRANT EXECUTE ON FUNCTION update_storage_capacity_from_inventory() TO anon;

-- Run the capacity update
SELECT update_storage_capacity_from_inventory();

-- 8. Final verification
SELECT '=== FINAL VERIFICATION ===' as status;

-- Check inventory data after cleanup
SELECT 
    'Inventory items after cleanup:' as check_type,
    COUNT(*) as total_items,
    COUNT(DISTINCT size_class) as unique_sizes,
    SUM(total_weight_grams) / 1000.0 as total_weight_kg
FROM sorting_results 
WHERE total_weight_grams > 0;

-- Check storage locations after update
SELECT 
    'Storage locations after update:' as check_type,
    name,
    capacity_kg,
    current_usage_kg,
    ROUND((current_usage_kg / capacity_kg * 100), 1) as utilization_percent
FROM storage_locations 
WHERE capacity_kg > 0
ORDER BY name;

SELECT 'Inventory data issues fixed successfully!' as final_status;
