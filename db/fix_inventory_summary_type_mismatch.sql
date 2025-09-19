-- Fix type mismatch in get_inventory_summary_with_storage function
-- The function declares total_quantity as INTEGER but SUM() returns BIGINT

-- Drop and recreate the function with correct type casting
DROP FUNCTION IF EXISTS get_inventory_summary_with_storage();

CREATE OR REPLACE FUNCTION get_inventory_summary_with_storage()
RETURNS TABLE(
    storage_location_id UUID,
    storage_location_name TEXT,
    total_quantity INTEGER,
    total_weight_kg DECIMAL(10,2),
    size_distribution JSONB,
    capacity_kg DECIMAL(10,2),
    current_usage_kg DECIMAL(10,2),
    utilization_percent DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        sl.id as storage_location_id,
        sl.name as storage_location_name,
        COALESCE(SUM(i.quantity)::INTEGER, 0) as total_quantity,  -- Cast BIGINT to INTEGER
        COALESCE(SUM(i.total_weight_kg), 0) as total_weight_kg,
        COALESCE(
            jsonb_object_agg(
                i.size::TEXT, 
                jsonb_build_object(
                    'quantity', i.quantity,
                    'weight_kg', i.total_weight_kg,
                    'avg_weight_per_fish', i.average_weight_per_fish
                )
            ) FILTER (WHERE i.size IS NOT NULL),
            '{}'::JSONB
        ) as size_distribution,
        sl.capacity_kg,
        sl.current_usage_kg,
        CASE 
            WHEN sl.capacity_kg > 0 THEN ROUND((sl.current_usage_kg / sl.capacity_kg) * 100, 2)
            ELSE 0
        END as utilization_percent
    FROM storage_locations sl
    LEFT JOIN inventory_with_storage i ON sl.id = i.storage_location_id AND i.quantity > 0
    WHERE sl.status = 'active'
    GROUP BY sl.id, sl.name, sl.capacity_kg, sl.current_usage_kg
    ORDER BY sl.name;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_inventory_summary_with_storage TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_summary_with_storage TO anon;
