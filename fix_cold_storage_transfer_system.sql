-- Complete Fix for Cold Storage Transfer System
-- This script fixes the transfer approval function and moves inventory for already approved transfers

-- 1. Drop existing transfer approval functions to avoid conflicts
DROP FUNCTION IF EXISTS approve_transfer(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS decline_transfer(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS approve_batch_transfer(UUID, UUID) CASCADE;

-- 2. Create a working approve_transfer function that actually moves inventory with capacity validation
CREATE OR REPLACE FUNCTION approve_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transfer RECORD;
    v_updated_rows INTEGER;
    v_source_inventory RECORD;
    v_destination_capacity DECIMAL(10,2);
    v_destination_current_usage DECIMAL(10,2);
    v_transfer_weight_kg DECIMAL(10,2);
    v_available_capacity DECIMAL(10,2);
BEGIN
    -- Get the transfer record
    SELECT * INTO v_transfer
    FROM transfers
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT;
        RETURN;
    END IF;
    
    -- Check if source has enough inventory
    SELECT 
        COUNT(*) as batch_count,
        SUM(total_pieces) as total_pieces,
        SUM(total_weight_grams) as total_weight_grams
    INTO v_source_inventory
    FROM sorting_results
    WHERE storage_location_id = v_transfer.from_storage_location_id
    AND size_class = v_transfer.size_class;
    
    IF v_source_inventory.total_pieces < v_transfer.quantity THEN
        RETURN QUERY SELECT FALSE, 
            'Insufficient inventory in source storage. Available: ' || v_source_inventory.total_pieces || 
            ', Required: ' || v_transfer.quantity::TEXT;
        RETURN;
    END IF;
    
    -- Calculate transfer weight
    v_transfer_weight_kg := v_transfer.weight_kg;
    
    -- Check destination storage capacity
    SELECT 
        capacity_kg,
        COALESCE(current_usage_kg, 0)
    INTO v_destination_capacity, v_destination_current_usage
    FROM storage_locations
    WHERE id = v_transfer.to_storage_location_id;
    
    -- Calculate available capacity
    v_available_capacity := v_destination_capacity - v_destination_current_usage;
    
    -- Check if destination has enough capacity
    IF v_available_capacity < v_transfer_weight_kg THEN
        RETURN QUERY SELECT FALSE, 
            'Insufficient capacity in destination storage. Available: ' || v_available_capacity::TEXT || 
            'kg, Required: ' || v_transfer_weight_kg::TEXT || 'kg'::TEXT;
        RETURN;
    END IF;
    
    -- Update transfer status to approved
    UPDATE transfers
    SET 
        status = 'approved',
        approved_by = p_approved_by,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id;
    
    -- Move inventory from source to destination storage
    -- This updates the storage_location_id in sorting_results to move the inventory
    UPDATE sorting_results
    SET 
        storage_location_id = v_transfer.to_storage_location_id,
        updated_at = NOW()
    WHERE storage_location_id = v_transfer.from_storage_location_id
    AND size_class = v_transfer.size_class
    AND total_pieces >= v_transfer.quantity;
    
    -- Check if the update was successful
    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    
    IF v_updated_rows = 0 THEN
        -- No inventory found to move - rollback the transfer status
        UPDATE transfers
        SET 
            status = 'pending',
            approved_by = NULL,
            approved_at = NULL,
            updated_at = NOW()
        WHERE id = p_transfer_id;
        
        RETURN QUERY SELECT FALSE, 'No inventory found to move for this transfer'::TEXT;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT TRUE, 'Transfer approved and inventory moved successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 3. Create decline_transfer function
CREATE OR REPLACE FUNCTION decline_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
BEGIN
    UPDATE transfers
    SET 
        status = 'declined',
        approved_by = p_approved_by,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF FOUND THEN
        RETURN QUERY SELECT TRUE, 'Transfer declined successfully'::TEXT;
    ELSE
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. Create function to validate storage capacity before transfer creation
CREATE OR REPLACE FUNCTION validate_transfer_capacity(
    p_to_storage_location_id UUID,
    p_weight_kg DECIMAL(10,2)
) RETURNS TABLE(
    is_valid BOOLEAN,
    message TEXT,
    available_capacity_kg DECIMAL(10,2),
    utilization_percent DECIMAL(5,2)
) AS $$
DECLARE
    v_capacity DECIMAL(10,2);
    v_current_usage DECIMAL(10,2);
    v_available_capacity DECIMAL(10,2);
    v_utilization_percent DECIMAL(5,2);
BEGIN
    -- Get storage capacity and current usage
    SELECT 
        capacity_kg,
        COALESCE(current_usage_kg, 0)
    INTO v_capacity, v_current_usage
    FROM storage_locations
    WHERE id = p_to_storage_location_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Storage location not found'::TEXT, 0::DECIMAL(10,2), 0::DECIMAL(5,2);
        RETURN;
    END IF;
    
    -- Calculate available capacity
    v_available_capacity := v_capacity - v_current_usage;
    v_utilization_percent := CASE 
        WHEN v_capacity > 0 THEN (v_current_usage / v_capacity) * 100
        ELSE 0
    END;
    
    -- Check if there's enough capacity
    IF v_available_capacity < p_weight_kg THEN
        RETURN QUERY SELECT FALSE, 
            'Insufficient capacity. Available: ' || v_available_capacity::TEXT || 
            'kg, Required: ' || p_weight_kg::TEXT || 'kg'::TEXT,
            v_available_capacity,
            v_utilization_percent;
        RETURN;
    END IF;
    
    -- Check if adding this weight would exceed 95% capacity (warning threshold)
    IF (v_current_usage + p_weight_kg) / v_capacity > 0.95 THEN
        RETURN QUERY SELECT TRUE, 
            'WARNING: Transfer will exceed 95% capacity. Current: ' || v_utilization_percent::TEXT || 
            '%, After transfer: ' || ((v_current_usage + p_weight_kg) / v_capacity * 100)::TEXT || '%'::TEXT,
            v_available_capacity,
            v_utilization_percent;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT TRUE, 'Capacity validation passed'::TEXT, v_available_capacity, v_utilization_percent;
END;
$$ LANGUAGE plpgsql;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_transfer_capacity(UUID, DECIMAL) TO authenticated;

-- 6. Fix already approved transfers that didn't move inventory
-- Move inventory for approved transfers from Cold Storage A to Cold Storage B
UPDATE sorting_results 
SET 
    storage_location_id = (SELECT id FROM storage_locations WHERE name = 'Cold Storage B'),
    updated_at = NOW()
WHERE storage_location_id = (SELECT id FROM storage_locations WHERE name = 'Cold Storage A')
AND size_class IN (2, 3, 0)  -- Based on the approved transfers we saw
AND id IN (
    SELECT sr.id 
    FROM sorting_results sr
    JOIN transfers t ON sr.storage_location_id = t.from_storage_location_id 
        AND sr.size_class = t.size_class
    WHERE t.status = 'approved' 
    AND t.to_storage_location_id = (SELECT id FROM storage_locations WHERE name = 'Cold Storage B')
    AND t.from_storage_location_id = (SELECT id FROM storage_locations WHERE name = 'Cold Storage A')
);

-- 7. Update storage capacity calculations
-- This ensures the green bars show correct utilization
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
END;
$$ LANGUAGE plpgsql;

-- Run the capacity update
SELECT update_storage_capacity_from_inventory();

-- 8. Test capacity validation function
SELECT '=== TESTING CAPACITY VALIDATION ===' as test_section;

-- Test capacity validation for Cold Storage A
SELECT 
    'Cold Storage A Capacity Test' as test_name,
    *
FROM validate_transfer_capacity(
    (SELECT id FROM storage_locations WHERE name = 'Cold Storage A'),
    100.0
);

-- Test capacity validation for Cold Storage B
SELECT 
    'Cold Storage B Capacity Test' as test_name,
    *
FROM validate_transfer_capacity(
    (SELECT id FROM storage_locations WHERE name = 'Cold Storage B'),
    100.0
);

-- 9. Check results
SELECT '=== TRANSFER SYSTEM FIX COMPLETED ===' as status;

-- Show current inventory distribution
SELECT 
    sl.name as storage_name,
    sl.location_type,
    sl.capacity_kg,
    sl.current_usage_kg,
    ROUND((sl.current_usage_kg / sl.capacity_kg) * 100, 2) as utilization_percent,
    COUNT(sr.id) as batch_count
FROM storage_locations sl
LEFT JOIN sorting_results sr ON sl.id = sr.storage_location_id
WHERE sl.location_type = 'cold_storage'
GROUP BY sl.id, sl.name, sl.location_type, sl.capacity_kg, sl.current_usage_kg
ORDER BY sl.name;

-- Show recent transfers status
SELECT 
    t.id,
    sl_from.name as from_storage,
    sl_to.name as to_storage,
    t.size_class,
    t.quantity,
    t.status,
    t.approved_at
FROM transfers t
JOIN storage_locations sl_from ON t.from_storage_location_id = sl_from.id
JOIN storage_locations sl_to ON t.to_storage_location_id = sl_to.id
WHERE (sl_from.location_type = 'cold_storage' OR sl_to.location_type = 'cold_storage')
ORDER BY t.created_at DESC
LIMIT 10;
