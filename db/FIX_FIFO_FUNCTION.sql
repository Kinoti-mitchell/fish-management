-- Fix FIFO Function 400 Error
-- This script creates a simple, working version of the FIFO function

-- Step 1: Drop the problematic function
DROP FUNCTION IF EXISTS get_inventory_with_fifo_ordering CASCADE;

-- Step 2: Create a simple working version
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
    -- Update storage capacity first
    PERFORM update_storage_capacity_from_inventory();
    
    RETURN QUERY
    WITH storage_info AS (
        SELECT 
            sl.id,
            sl.name,
            sl.location_type,
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
    inventory_data AS (
        SELECT 
            sr.storage_location_id,
            sr.size_class,
            SUM(sr.total_pieces) as total_quantity,
            SUM(sr.total_weight_grams) / 1000.0 as total_weight_kg,
            COUNT(DISTINCT sr.sorting_batch_id) as batch_count,
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'batch_id', sr.sorting_batch_id,
                    'batch_number', COALESCE(sb.batch_number, 'BATCH-' || SUBSTRING(sr.sorting_batch_id::text, 1, 8)),
                    'quantity', sr.total_pieces,
                    'weight_kg', sr.total_weight_grams / 1000.0,
                    'created_at', COALESCE(sb.created_at, NOW()),
                    'farmer_name', COALESCE(f.name, 'Unknown'),
                    'processing_date', COALESCE(pr.processing_date, NOW()::date)
                ) ORDER BY COALESCE(sb.created_at, NOW())
            ) as contributing_batches,
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'batch_id', sr.sorting_batch_id,
                    'batch_number', COALESCE(sb.batch_number, 'BATCH-' || SUBSTRING(sr.sorting_batch_id::text, 1, 8)),
                    'quantity', sr.total_pieces,
                    'weight_kg', sr.total_weight_grams / 1000.0,
                    'created_at', COALESCE(sb.created_at, NOW())
                ) ORDER BY COALESCE(sb.created_at, NOW())
            ) as fifo_batches
        FROM sorting_results sr
        LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
        LEFT JOIN processing_records pr ON sb.processing_record_id = pr.id
        LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
        LEFT JOIN farmers f ON we.farmer_id = f.id
        WHERE COALESCE(sb.status, 'completed') = 'completed'
        AND sr.storage_location_id IS NOT NULL
        AND sr.total_pieces > 0
        GROUP BY sr.storage_location_id, sr.size_class
    )
    SELECT 
        si.id as storage_location_id,
        si.name as storage_location_name,
        si.location_type as storage_location_type,
        si.capacity_kg,
        si.current_usage_kg,
        si.available_capacity_kg,
        si.utilization_percent,
        id.size_class as size,
        COALESCE(id.total_quantity, 0) as total_quantity,
        COALESCE(id.total_weight_kg, 0) as total_weight_kg,
        COALESCE(id.batch_count, 0) as batch_count,
        COALESCE(id.contributing_batches, '[]'::jsonb) as contributing_batches,
        COALESCE(id.fifo_batches, '[]'::jsonb) as fifo_batches
    FROM storage_info si
    LEFT JOIN inventory_data id ON si.id = id.storage_location_id
    ORDER BY si.name, id.size_class;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION get_inventory_with_fifo_ordering TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_with_fifo_ordering TO anon;

-- Step 4: Update storage capacities
SELECT update_storage_capacity_from_inventory();
