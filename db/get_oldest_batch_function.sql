-- Function to get the oldest batch that is yet to be removed
-- This shows the batch that should be processed first (FIFO)

CREATE OR REPLACE FUNCTION get_oldest_batch_for_removal()
RETURNS TABLE(
    batch_id UUID,
    batch_number TEXT,
    size_class INTEGER,
    total_pieces INTEGER,
    total_weight_kg DECIMAL(10,2),
    storage_location_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    processing_date DATE,
    farmer_name TEXT,
    days_in_storage INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sb.id as batch_id,
        sb.batch_number,
        sr.size_class,
        sr.total_pieces,
        sr.total_weight_grams / 1000.0 as total_weight_kg,
        sl.name as storage_location_name,
        sb.created_at,
        pr.processing_date,
        f.name as farmer_name,
        EXTRACT(DAYS FROM (NOW() - sb.created_at))::INTEGER as days_in_storage
    FROM sorting_results sr
    JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    JOIN processing_records pr ON sb.processing_record_id = pr.id
    JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
    JOIN farmers f ON we.farmer_id = f.id
    JOIN storage_locations sl ON sr.storage_location_id = sl.id
    WHERE sb.status = 'completed'
    AND sr.storage_location_id IS NOT NULL
    AND sr.total_pieces > 0  -- Only batches with remaining inventory
    ORDER BY sb.created_at ASC  -- Oldest first (FIFO)
    LIMIT 10;  -- Show top 10 oldest batches
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_oldest_batch_for_removal TO authenticated;

-- Test the function
SELECT 'Testing oldest batch function...' as status;
SELECT 
    batch_number,
    size_class,
    total_pieces,
    total_weight_kg,
    storage_location_name,
    created_at,
    days_in_storage
FROM get_oldest_batch_for_removal()
LIMIT 5;
