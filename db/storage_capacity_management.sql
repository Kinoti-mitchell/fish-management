-- Storage Capacity Management
-- This script handles storage capacity checking and prevents selection of full storage locations

-- Step 1: Check current storage locations and their usage
SELECT 
    'Current storage capacity analysis:' as analysis,
    sl.name,
    sl.capacity_kg,
    sl.current_usage_kg,
    ROUND((sl.current_usage_kg / sl.capacity_kg) * 100, 2) as utilization_percent,
    CASE 
        WHEN sl.current_usage_kg >= sl.capacity_kg THEN 'FULL'
        WHEN sl.current_usage_kg >= (sl.capacity_kg * 0.9) THEN 'NEARLY_FULL'
        WHEN sl.current_usage_kg >= (sl.capacity_kg * 0.7) THEN 'MODERATE'
        ELSE 'AVAILABLE'
    END as capacity_status
FROM storage_locations sl
WHERE sl.status = 'active'
ORDER BY utilization_percent DESC;

-- Step 2: Create function to check storage capacity status
CREATE OR REPLACE FUNCTION get_storage_capacity_status(p_storage_location_id UUID DEFAULT NULL)
RETURNS TABLE(
    storage_location_id UUID,
    storage_location_name TEXT,
    capacity_kg DECIMAL(10,2),
    current_usage_kg DECIMAL(10,2),
    available_capacity_kg DECIMAL(10,2),
    utilization_percent DECIMAL(5,2),
    capacity_status TEXT,
    is_available BOOLEAN,
    can_accept_weight DECIMAL(10,2)
) AS $$
BEGIN
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
        CASE 
            WHEN sl.current_usage_kg >= sl.capacity_kg THEN 'FULL'
            WHEN sl.current_usage_kg >= (sl.capacity_kg * 0.95) THEN 'NEARLY_FULL'
            WHEN sl.current_usage_kg >= (sl.capacity_kg * 0.8) THEN 'MODERATE'
            ELSE 'AVAILABLE'
        END as capacity_status,
        (sl.current_usage_kg < sl.capacity_kg AND sl.status = 'active') as is_available,
        GREATEST(0, sl.capacity_kg - sl.current_usage_kg) as can_accept_weight
    FROM storage_locations sl
    WHERE (p_storage_location_id IS NULL OR sl.id = p_storage_location_id)
    ORDER BY 
        CASE 
            WHEN sl.current_usage_kg >= sl.capacity_kg THEN 4
            WHEN sl.current_usage_kg >= (sl.capacity_kg * 0.95) THEN 3
            WHEN sl.current_usage_kg >= (sl.capacity_kg * 0.8) THEN 2
            ELSE 1
        END,
        sl.name;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create function to get available storage locations for sorting
CREATE OR REPLACE FUNCTION get_available_storage_locations_for_sorting(
    p_required_weight_kg DECIMAL(10,2) DEFAULT 0
)
RETURNS TABLE(
    storage_location_id UUID,
    storage_location_name TEXT,
    location_type TEXT,
    capacity_kg DECIMAL(10,2),
    current_usage_kg DECIMAL(10,2),
    available_capacity_kg DECIMAL(10,2),
    utilization_percent DECIMAL(5,2),
    can_accommodate BOOLEAN,
    recommended_for_weight DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        sl.id as storage_location_id,
        sl.name as storage_location_name,
        sl.location_type,
        sl.capacity_kg,
        sl.current_usage_kg,
        (sl.capacity_kg - sl.current_usage_kg) as available_capacity_kg,
        CASE 
            WHEN sl.capacity_kg > 0 THEN ROUND((sl.current_usage_kg / sl.capacity_kg) * 100, 2)
            ELSE 0
        END as utilization_percent,
        (sl.current_usage_kg + p_required_weight_kg <= sl.capacity_kg AND sl.status = 'active') as can_accommodate,
        GREATEST(0, sl.capacity_kg - sl.current_usage_kg) as recommended_for_weight
    FROM storage_locations sl
    WHERE sl.status = 'active'
    AND sl.current_usage_kg + p_required_weight_kg <= sl.capacity_kg
    ORDER BY 
        -- Prefer locations with more available space
        (sl.capacity_kg - sl.current_usage_kg) DESC,
        -- Then by utilization (lower is better)
        (sl.current_usage_kg / sl.capacity_kg) ASC,
        sl.name;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create function to validate storage location selection for sorting
CREATE OR REPLACE FUNCTION validate_storage_location_for_sorting(
    p_storage_location_id UUID,
    p_estimated_weight_kg DECIMAL(10,2) DEFAULT 0
)
RETURNS TABLE(
    is_valid BOOLEAN,
    message TEXT,
    storage_location_name TEXT,
    available_capacity_kg DECIMAL(10,2),
    utilization_percent DECIMAL(5,2)
) AS $$
DECLARE
    v_storage_location RECORD;
BEGIN
    -- Get storage location details
    SELECT * INTO v_storage_location
    FROM storage_locations
    WHERE id = p_storage_location_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Storage location not found'::TEXT, ''::TEXT, 0::DECIMAL(10,2), 0::DECIMAL(5,2);
        RETURN;
    END IF;
    
    IF v_storage_location.status != 'active' THEN
        RETURN QUERY SELECT FALSE, 'Storage location is not active'::TEXT, v_storage_location.name, 0::DECIMAL(10,2), 0::DECIMAL(5,2);
        RETURN;
    END IF;
    
    IF v_storage_location.current_usage_kg + p_estimated_weight_kg > v_storage_location.capacity_kg THEN
        RETURN QUERY SELECT 
            FALSE, 
            'Storage location does not have enough capacity'::TEXT, 
            v_storage_location.name,
            (v_storage_location.capacity_kg - v_storage_location.current_usage_kg),
            ROUND((v_storage_location.current_usage_kg / v_storage_location.capacity_kg) * 100, 2);
        RETURN;
    END IF;
    
    -- Valid storage location
    RETURN QUERY SELECT 
        TRUE, 
        'Storage location is available'::TEXT, 
        v_storage_location.name,
        (v_storage_location.capacity_kg - v_storage_location.current_usage_kg),
        ROUND((v_storage_location.current_usage_kg / v_storage_location.capacity_kg) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create function to update storage location usage when adding inventory
CREATE OR REPLACE FUNCTION update_storage_usage_on_inventory_add(
    p_storage_location_id UUID,
    p_weight_kg DECIMAL(10,2)
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    new_usage_kg DECIMAL(10,2),
    utilization_percent DECIMAL(5,2)
) AS $$
DECLARE
    v_storage_location RECORD;
    v_new_usage DECIMAL(10,2);
    v_utilization DECIMAL(5,2);
BEGIN
    -- Get current storage location
    SELECT * INTO v_storage_location
    FROM storage_locations
    WHERE id = p_storage_location_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Storage location not found'::TEXT, 0::DECIMAL(10,2), 0::DECIMAL(5,2);
        RETURN;
    END IF;
    
    -- Calculate new usage
    v_new_usage := v_storage_location.current_usage_kg + p_weight_kg;
    
    -- Check if it exceeds capacity
    IF v_new_usage > v_storage_location.capacity_kg THEN
        RETURN QUERY SELECT 
            FALSE, 
            'Adding this weight would exceed storage capacity'::TEXT, 
            v_storage_location.current_usage_kg,
            ROUND((v_storage_location.current_usage_kg / v_storage_location.capacity_kg) * 100, 2);
        RETURN;
    END IF;
    
    -- Update storage location usage
    UPDATE storage_locations 
    SET current_usage_kg = v_new_usage,
        updated_at = NOW()
    WHERE id = p_storage_location_id;
    
    v_utilization := ROUND((v_new_usage / v_storage_location.capacity_kg) * 100, 2);
    
    RETURN QUERY SELECT TRUE, 'Storage usage updated successfully'::TEXT, v_new_usage, v_utilization;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create function to get storage capacity alerts
CREATE OR REPLACE FUNCTION get_storage_capacity_alerts()
RETURNS TABLE(
    storage_location_id UUID,
    storage_location_name TEXT,
    alert_type TEXT,
    alert_message TEXT,
    current_usage_kg DECIMAL(10,2),
    capacity_kg DECIMAL(10,2),
    utilization_percent DECIMAL(5,2),
    recommended_action TEXT
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        sl.id as storage_location_id,
        sl.name as storage_location_name,
        CASE 
            WHEN sl.current_usage_kg >= sl.capacity_kg THEN 'CRITICAL'
            WHEN sl.current_usage_kg >= (sl.capacity_kg * 0.95) THEN 'WARNING'
            WHEN sl.current_usage_kg >= (sl.capacity_kg * 0.8) THEN 'INFO'
            ELSE NULL
        END as alert_type,
        CASE 
            WHEN sl.current_usage_kg >= sl.capacity_kg THEN 'Storage location is FULL - cannot accept more inventory'
            WHEN sl.current_usage_kg >= (sl.capacity_kg * 0.95) THEN 'Storage location is nearly full (95%+ capacity)'
            WHEN sl.current_usage_kg >= (sl.capacity_kg * 0.8) THEN 'Storage location is getting full (80%+ capacity)'
            ELSE NULL
        END as alert_message,
        sl.current_usage_kg,
        sl.capacity_kg,
        ROUND((sl.current_usage_kg / sl.capacity_kg) * 100, 2) as utilization_percent,
        CASE 
            WHEN sl.current_usage_kg >= sl.capacity_kg THEN 'Transfer inventory to another location or dispatch orders'
            WHEN sl.current_usage_kg >= (sl.capacity_kg * 0.95) THEN 'Consider transferring some inventory or prioritize dispatch'
            WHEN sl.current_usage_kg >= (sl.capacity_kg * 0.8) THEN 'Monitor closely and plan for inventory movement'
            ELSE NULL
        END as recommended_action
    FROM storage_locations sl
    WHERE sl.status = 'active'
    AND (
        sl.current_usage_kg >= sl.capacity_kg OR
        sl.current_usage_kg >= (sl.capacity_kg * 0.8)
    )
    ORDER BY 
        CASE 
            WHEN sl.current_usage_kg >= sl.capacity_kg THEN 1
            WHEN sl.current_usage_kg >= (sl.capacity_kg * 0.95) THEN 2
            ELSE 3
        END,
        (sl.current_usage_kg / sl.capacity_kg) DESC;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Grant permissions
GRANT EXECUTE ON FUNCTION get_storage_capacity_status TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_storage_locations_for_sorting TO authenticated;
GRANT EXECUTE ON FUNCTION validate_storage_location_for_sorting TO authenticated;
GRANT EXECUTE ON FUNCTION update_storage_usage_on_inventory_add TO authenticated;
GRANT EXECUTE ON FUNCTION get_storage_capacity_alerts TO authenticated;

-- Step 8: Test the functions
SELECT 
    'Testing storage capacity functions:' as test,
    COUNT(*) as total_storage_locations,
    COUNT(CASE WHEN is_available THEN 1 END) as available_locations,
    COUNT(CASE WHEN NOT is_available THEN 1 END) as full_locations
FROM get_storage_capacity_status();

-- Step 9: Show available storage locations for sorting (with 50kg requirement)
SELECT 
    'Available storage locations for sorting (50kg requirement):' as available,
    storage_location_name,
    available_capacity_kg,
    utilization_percent,
    can_accommodate
FROM get_available_storage_locations_for_sorting(50.0);

-- Step 10: Show storage capacity alerts
SELECT 
    'Storage capacity alerts:' as alerts,
    storage_location_name,
    alert_type,
    alert_message,
    utilization_percent,
    recommended_action
FROM get_storage_capacity_alerts();

-- Step 11: Final status
SELECT 
    'Storage capacity management system completed!' as status,
    COUNT(*) as total_functions_created,
    (SELECT COUNT(*) FROM storage_locations WHERE status = 'active') as active_storage_locations,
    (SELECT COUNT(*) FROM get_storage_capacity_status() WHERE is_available) as available_locations,
    (SELECT COUNT(*) FROM get_storage_capacity_status() WHERE NOT is_available) as full_locations;
