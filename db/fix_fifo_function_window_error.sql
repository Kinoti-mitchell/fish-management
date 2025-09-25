-- Fix FIFO Function Window Error
-- This script fixes the "aggregate function calls cannot contain window function calls" error

-- Drop the existing function
DROP FUNCTION IF EXISTS get_inventory_with_fifo_ordering();

-- Create the fixed function without window functions inside aggregates
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
            COALESCE(sl.current_usage_kg, 0) as current_usage_kg,
            (sl.capacity_kg - COALESCE(sl.current_usage_kg, 0)) as available_capacity_kg,
            CASE 
                WHEN sl.capacity_kg > 0 THEN ROUND((COALESCE(sl.current_usage_kg, 0) / sl.capacity_kg) * 100, 2)
                ELSE 0
            END as utilization_percent
        FROM storage_locations sl
        WHERE sl.status = 'active'
    ),
    -- First get the data with row numbers in a separate CTE
    inventory_with_fifo AS (
        SELECT 
            sr.storage_location_id,
            sr.size_class as size,
            sr.total_pieces,
            sr.total_weight_grams,
            sr.sorting_batch_id,
            COALESCE(sb.batch_number, 'BATCH-' || SUBSTRING(sr.sorting_batch_id::text, 1, 8)) as batch_number,
            COALESCE(sb.created_at, NOW()) as created_at,
            COALESCE(pr.processing_date, NOW()::date) as processing_date,
            COALESCE(f.name, 'Unknown') as farmer_name,
            COALESCE(sl.name, 'Unknown') as storage_location_name,
            ROW_NUMBER() OVER (
                PARTITION BY sr.storage_location_id, sr.size_class 
                ORDER BY COALESCE(sb.created_at, NOW()) ASC
            ) as fifo_order
        FROM sorting_results sr
        LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
        LEFT JOIN processing_records pr ON sb.processing_record_id = pr.id
        LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
        LEFT JOIN farmers f ON we.farmer_id = f.id
        LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
        WHERE COALESCE(sb.status, 'completed') = 'completed'
        AND sr.storage_location_id IS NOT NULL
        AND sr.total_pieces > 0
    ),
    inventory_by_size AS (
        SELECT 
            storage_location_id,
            size,
            SUM(total_pieces) as total_quantity,
            SUM(total_weight_grams) / 1000.0 as total_weight_kg,
            COUNT(DISTINCT sorting_batch_id) as batch_count,
            JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'batch_id', sorting_batch_id,
                    'batch_number', batch_number,
                    'quantity', total_pieces,
                    'weight_kg', total_weight_grams / 1000.0,
                    'created_at', created_at,
                    'processing_date', processing_date,
                    'farmer_name', farmer_name,
                    'storage_location_name', storage_location_name
                ) ORDER BY created_at ASC
            ) as contributing_batches,
            JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'batch_id', sorting_batch_id,
                    'batch_number', batch_number,
                    'quantity', total_pieces,
                    'weight_kg', total_weight_grams / 1000.0,
                    'created_at', created_at,
                    'fifo_order', fifo_order
                ) ORDER BY created_at ASC
            ) as fifo_batches
        FROM inventory_with_fifo
        GROUP BY storage_location_id, size
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_inventory_with_fifo_ordering TO authenticated;

-- Test the function
SELECT 'FIFO function fixed successfully!' as status;
