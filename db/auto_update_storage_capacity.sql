-- Auto-update storage capacity when inventory changes
-- This ensures storage capacity tracking stays accurate

-- Function to update storage capacity based on actual inventory
CREATE OR REPLACE FUNCTION update_storage_capacity_from_inventory()
RETURNS BOOLEAN AS $$
DECLARE
    v_storage_location RECORD;
    v_actual_usage DECIMAL(10,2);
BEGIN
    -- Update each storage location with actual inventory usage
    FOR v_storage_location IN
        SELECT sl.id, sl.name
        FROM storage_locations sl
        WHERE sl.status = 'active'
    LOOP
        -- Calculate actual usage from sorting_results
        SELECT COALESCE(SUM(sr.total_weight_grams) / 1000.0, 0) INTO v_actual_usage
        FROM sorting_results sr
        WHERE sr.storage_location_id = v_storage_location.id;
        
        -- Update storage location with actual usage
        UPDATE storage_locations
        SET current_usage_kg = v_actual_usage,
            updated_at = NOW()
        WHERE id = v_storage_location.id;
        
        RAISE NOTICE 'Updated % usage to %kg', v_storage_location.name, v_actual_usage;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get storage locations available for sorting
CREATE OR REPLACE FUNCTION get_available_storage_for_sorting(
    p_required_weight_kg DECIMAL(10,2) DEFAULT 0
)
RETURNS TABLE(
    storage_location_id UUID,
    storage_location_name TEXT,
    capacity_kg DECIMAL(10,2),
    current_usage_kg DECIMAL(10,2),
    available_capacity_kg DECIMAL(10,2),
    utilization_percent DECIMAL(5,2),
    can_accommodate BOOLEAN
) AS $$
BEGIN
    -- First update capacity from actual inventory
    PERFORM update_storage_capacity_from_inventory();
    
    -- Then return available locations
    RETURN QUERY
    SELECT 
        sl.id as storage_location_id,
        sl.name as storage_location_name,
        sl.capacity_kg,
        sl.current_usage_kg,
        (sl.capacity_kg - sl.current_usage_kg) as available_capacity_kg,
        CASE 
            WHEN sl.capacity_kg > 0 THEN ROUND((sl.current_usage_kg / sl.capacity_kg) * 100, 2)
            ELSE 0
        END as utilization_percent,
        (sl.current_usage_kg + p_required_weight_kg < sl.capacity_kg AND sl.status = 'active') as can_accommodate
    FROM storage_locations sl
    WHERE sl.status = 'active'
    AND sl.current_usage_kg + p_required_weight_kg < sl.capacity_kg
    ORDER BY 
        -- Prefer locations with more available space
        (sl.capacity_kg - sl.current_usage_kg) DESC,
        -- Then by lower utilization
        (sl.current_usage_kg / sl.capacity_kg) ASC,
        sl.name;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to update storage capacity when sorting_results change
CREATE OR REPLACE FUNCTION trigger_update_storage_capacity()
RETURNS TRIGGER AS $$
BEGIN
    -- Update capacity for the affected storage location
    PERFORM update_storage_capacity_from_inventory();
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update storage capacity
DROP TRIGGER IF EXISTS trigger_sorting_results_storage_capacity ON sorting_results;
CREATE TRIGGER trigger_sorting_results_storage_capacity
    AFTER INSERT OR UPDATE OR DELETE ON sorting_results
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_storage_capacity();

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_storage_capacity_from_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_storage_for_sorting TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_update_storage_capacity TO authenticated;

-- Run initial capacity update
SELECT 'Updating storage capacity from actual inventory...' as status;
SELECT update_storage_capacity_from_inventory();

SELECT 'Storage capacity auto-update system installed successfully!' as status;
