-- Fix Storage Capacity Update Function
-- This fixes the "UPDATE requires a WHERE clause" error

-- Drop and recreate the function to ensure it works properly
DROP FUNCTION IF EXISTS update_storage_capacity_from_inventory() CASCADE;

-- Create the function with proper syntax
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
    
    -- Log the update
    RAISE NOTICE 'Storage capacity updated for all locations';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_storage_capacity_from_inventory() TO authenticated;
GRANT EXECUTE ON FUNCTION update_storage_capacity_from_inventory() TO anon;

-- Test the function
SELECT 'Testing storage capacity update function...' as test_name;
SELECT update_storage_capacity_from_inventory();

-- Check results
SELECT 'Storage locations after update:' as result_name;
SELECT 
    name,
    capacity_kg,
    current_usage_kg,
    ROUND((current_usage_kg / capacity_kg * 100), 1) as utilization_percent
FROM storage_locations 
ORDER BY name;

SELECT 'Storage capacity update function fixed successfully!' as final_status;
