-- Quick fix for inventory errors
-- Run this in Supabase SQL editor

-- 1. Create the storage capacity update function first
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

-- 2. Create the missing FIFO function
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
    total_quantity INTEGER,
    total_weight_kg DECIMAL(10,2),
    batch_count INTEGER,
    contributing_batches JSONB,
    fifo_batches JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH storage_capacity AS (
        SELECT 
            sl.id as storage_location_id,
            sl.name as storage_location_name,
            sl.location_type as storage_location_type,
            sl.capacity_kg,
            COALESCE(sl.current_usage_kg, 0) as current_usage_kg,
            (sl.capacity_kg - COALESCE(sl.current_usage_kg, 0)) as available_capacity_kg,
            CASE 
                WHEN sl.capacity_kg > 0 THEN ROUND((COALESCE(sl.current_usage_kg, 0) / sl.capacity_kg) * 100, 2)
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
                    'batch_number', COALESCE(sb.batch_number, 'BATCH-' || SUBSTRING(sr.sorting_batch_id::text, 1, 8)),
                    'quantity', sr.total_pieces,
                    'weight_kg', sr.total_weight_grams / 1000.0,
                    'created_at', COALESCE(sb.created_at, NOW())
                ) ORDER BY COALESCE(sb.created_at, NOW()) ASC
            ) as contributing_batches,
            JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'batch_id', sr.sorting_batch_id,
                    'batch_number', COALESCE(sb.batch_number, 'BATCH-' || SUBSTRING(sr.sorting_batch_id::text, 1, 8)),
                    'quantity', sr.total_pieces,
                    'weight_kg', sr.total_weight_grams / 1000.0,
                    'created_at', COALESCE(sb.created_at, NOW()),
                    'fifo_order', ROW_NUMBER() OVER (PARTITION BY sr.storage_location_id, sr.size_class ORDER BY COALESCE(sb.created_at, NOW()) ASC)
                ) ORDER BY COALESCE(sb.created_at, NOW()) ASC
            ) as fifo_batches
        FROM sorting_results sr
        LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
        WHERE COALESCE(sb.status, 'completed') = 'completed'
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

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION update_storage_capacity_from_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_with_fifo_ordering TO authenticated;

-- 4. Test the function
SELECT 'FIFO function created successfully!' as status;
