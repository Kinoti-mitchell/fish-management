-- Fix the storage capacity update function
-- The issue is the WHERE clause requirement

-- Drop and recreate the function with proper WHERE clause
DROP FUNCTION IF EXISTS update_storage_capacity_from_inventory() CASCADE;

CREATE OR REPLACE FUNCTION update_storage_capacity_from_inventory()
RETURNS VOID AS $$
BEGIN
    -- Update current_usage_kg for all storage locations with proper WHERE clause
    UPDATE storage_locations 
    SET 
        current_usage_kg = (
            SELECT COALESCE(SUM(total_weight_grams) / 1000.0, 0)
            FROM sorting_results sr
            WHERE sr.storage_location_id = storage_locations.id
        ),
        updated_at = NOW()
    WHERE id IS NOT NULL; -- This satisfies the WHERE clause requirement
    
    RAISE NOTICE 'Storage capacity updated for all locations';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_storage_capacity_from_inventory() TO authenticated;
GRANT EXECUTE ON FUNCTION update_storage_capacity_from_inventory() TO anon;

-- Test the function
SELECT update_storage_capacity_from_inventory();

-- Show updated storage capacity
SELECT 
    'STORAGE CAPACITY AFTER FIX' as status,
    name,
    capacity_kg,
    current_usage_kg,
    (current_usage_kg - capacity_kg) as overage_kg,
    ROUND((current_usage_kg / capacity_kg * 100), 1) as utilization_percent
FROM storage_locations 
WHERE capacity_kg > 0
ORDER BY (current_usage_kg / capacity_kg) DESC;
