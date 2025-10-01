-- Minimal Fix for Function Conflict Only
-- This only fixes the update_storage_capacity_from_inventory function conflict

-- Drop the existing function to resolve the return type conflict
DROP FUNCTION IF EXISTS update_storage_capacity_from_inventory() CASCADE;

-- Recreate the function with the correct return type
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
END;
$$ LANGUAGE plpgsql;

-- Run the capacity update
SELECT update_storage_capacity_from_inventory();

SELECT 'Function conflict resolved successfully' as status;
