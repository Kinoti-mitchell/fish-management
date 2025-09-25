-- Fix the JSONB/JSON conversion error in get_inventory_with_fifo_ordering function
-- The issue is with COALESCE trying to convert JSONB to JSON

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
            COALESCE(
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
                ) FILTER (WHERE sr.sorting_batch_id IS NOT NULL),
                '[]'::JSONB
            ) as contributing_batches,
            COALESCE(
                JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                        'batch_id', sr.sorting_batch_id,
                        'batch_number', sb.batch_number,
                        'quantity', sr.total_pieces,
                        'weight_kg', sr.total_weight_grams / 1000.0,
                        'created_at', sb.created_at,
                        'fifo_order', ROW_NUMBER() OVER (PARTITION BY sr.storage_location_id, sr.size_class ORDER BY sb.created_at ASC)
                    ) ORDER BY sb.created_at ASC
                ) FILTER (WHERE sr.sorting_batch_id IS NOT NULL),
                '[]'::JSONB
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_inventory_with_fifo_ordering TO authenticated;

-- Test the function
SELECT 'Testing fixed FIFO function...' as status;
SELECT 
    storage_location_name,
    size,
    total_quantity,
    total_weight_kg,
    batch_count
FROM get_inventory_with_fifo_ordering()
WHERE size IS NOT NULL
ORDER BY storage_location_name, size
LIMIT 5;
