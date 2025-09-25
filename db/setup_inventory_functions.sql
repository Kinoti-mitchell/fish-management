-- Quick Setup for Inventory Storage Functions
-- Run this script in your Supabase SQL editor to enable FIFO inventory management

-- Step 1: Create the storage capacity update function
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

-- Step 1.5: Ensure storage locations exist (handle existing locations)
INSERT INTO storage_locations (id, name, location_type, capacity_kg, status) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Cold Storage A', 'cold_storage', 2000, 'active'),
    ('22222222-2222-2222-2222-222222222222', 'Cold Storage B', 'cold_storage', 1500, 'active'),
    ('33333333-3333-3333-3333-333333333333', 'Freezer Unit 1', 'freezer', 1000, 'active'),
    ('44444444-4444-4444-4444-444444444444', 'Processing Area 1', 'processing', 500, 'active'),
    ('55555555-5555-5555-5555-555555555555', 'Processing Area 2', 'processing', 500, 'active')
ON CONFLICT (name) DO UPDATE SET
    location_type = EXCLUDED.location_type,
    capacity_kg = EXCLUDED.capacity_kg,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Step 1.6: Update storage capacity from actual inventory (moved to after function creation)

-- Step 2: Drop existing function if it exists, then create the main FIFO inventory function
DROP FUNCTION IF EXISTS get_inventory_with_fifo_ordering();

CREATE OR REPLACE FUNCTION get_inventory_with_fifo_ordering()
RETURNS TABLE(
    storage_location_id UUID,
    storage_location_name TEXT,
    storage_location_type TEXT,
    capacity_kg DECIMAL(10,2),
    current_usage_kg DECIMAL(10,2),
    available_capacity_kg DECIMAL(10,2),
    utilization_percent DECIMAL(5,2),
    size INTEGER,
    total_quantity BIGINT,
    total_weight_kg DECIMAL(10,2),
    batch_count BIGINT,
    contributing_batches JSONB,
    fifo_batches JSONB
) AS $$
BEGIN
    -- First update capacity from actual inventory
    PERFORM update_storage_capacity_from_inventory();
    
    RETURN QUERY
    WITH storage_capacity AS (
        SELECT 
            sl.id as storage_location_id,
            sl.name as storage_location_name,
            sl.location_type as storage_location_type,
            sl.capacity_kg,
            sl.current_usage_kg,
            (sl.capacity_kg - sl.current_usage_kg) as available_capacity_kg,
            CASE 
                WHEN sl.capacity_kg > 0 THEN ROUND((sl.current_usage_kg / sl.capacity_kg) * 100, 2)
                ELSE 0
            END as utilization_percent
        FROM storage_locations sl
        WHERE sl.status = 'active'
    ),
    inventory_by_size AS (
        SELECT 
            sr.storage_location_id,
            sr.size_class as size,
            SUM(sr.total_pieces) as total_quantity,
            SUM(sr.total_weight_grams) / 1000.0 as total_weight_kg,
            COUNT(DISTINCT sr.sorting_batch_id) as batch_count,
            JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'batch_id', sr.sorting_batch_id,
                    'batch_number', sb.batch_number,
                    'quantity', sr.total_pieces,
                    'weight_kg', sr.total_weight_grams / 1000.0,
                    'created_at', sb.created_at,
                    'processing_date', pr.processing_date,
                    'farmer_name', f.name,
                    'storage_location_name', sl.name
                ) ORDER BY sb.created_at ASC
            ) as contributing_batches,
            JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'batch_id', sr.sorting_batch_id,
                    'batch_number', sb.batch_number,
                    'quantity', sr.total_pieces,
                    'weight_kg', sr.total_weight_grams / 1000.0,
                    'created_at', sb.created_at
                ) ORDER BY sb.created_at ASC
            ) as fifo_batches
        FROM sorting_results sr
        JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
        JOIN processing_records pr ON sb.processing_record_id = pr.id
        JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
        JOIN farmers f ON we.farmer_id = f.id
        JOIN storage_locations sl ON sr.storage_location_id = sl.id
        WHERE sb.status = 'completed'
        AND sr.storage_location_id IS NOT NULL
        GROUP BY sr.storage_location_id, sr.size_class
    )
    SELECT 
        sc.storage_location_id,
        sc.storage_location_name,
        sc.storage_location_type,
        sc.capacity_kg,
        sc.current_usage_kg,
        sc.available_capacity_kg,
        sc.utilization_percent,
        ibs.size,
        ibs.total_quantity,
        ibs.total_weight_kg,
        ibs.batch_count,
        ibs.contributing_batches,
        ibs.fifo_batches
    FROM storage_capacity sc
    LEFT JOIN inventory_by_size ibs ON sc.storage_location_id = ibs.storage_location_id
    ORDER BY sc.storage_location_name, ibs.size;
END;
$$ LANGUAGE plpgsql;

-- Step 2.5: Update storage capacity from actual inventory
SELECT 'Updating storage capacity from actual inventory...' as status;
SELECT update_storage_capacity_from_inventory();

-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION get_inventory_with_fifo_ordering TO authenticated;

-- Step 4: Test the function
SELECT 'Testing inventory function...' as test;
SELECT 
    storage_location_name,
    size,
    total_quantity,
    total_weight_kg,
    utilization_percent
FROM get_inventory_with_fifo_ordering()
WHERE size IS NOT NULL
ORDER BY storage_location_name, size
LIMIT 5;

-- Step 5: Show current storage status
SELECT 'Current storage status:' as status;
SELECT 
    storage_location_name,
    capacity_kg,
    current_usage_kg,
    available_capacity_kg,
    utilization_percent
FROM get_inventory_with_fifo_ordering()
WHERE size IS NULL
ORDER BY storage_location_name;

SELECT 'Inventory functions setup completed!' as status;
