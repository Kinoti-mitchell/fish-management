-- Fix for get_inventory_for_disposal function structure issue
-- This fixes the "structure of query does not match function result type" error

-- Drop and recreate the function with correct structure
DROP FUNCTION IF EXISTS get_inventory_for_disposal(INTEGER, BOOLEAN);

CREATE OR REPLACE FUNCTION get_inventory_for_disposal(
    p_days_old INTEGER DEFAULT 30,
    p_include_storage_issues BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
    sorting_result_id UUID,
    size_class INTEGER,
    total_pieces INTEGER,
    total_weight_grams DECIMAL(12,2),
    batch_number TEXT,
    storage_location_name TEXT,
    farmer_name TEXT,
    processing_date DATE,
    days_in_storage INTEGER,
    disposal_reason TEXT,
    quality_notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sr.id::UUID as sorting_result_id,
        sr.size_class::INTEGER as size_class,
        sr.total_pieces::INTEGER as total_pieces,
        sr.total_weight_grams::DECIMAL(12,2) as total_weight_grams,
        COALESCE(sb.batch_number, 'BATCH-' || SUBSTRING(sb.id::text, 1, 8))::TEXT as batch_number,
        COALESCE(sl.name, 'Unknown Storage')::TEXT as storage_location_name,
        COALESCE(f.name, 'Unknown Farmer')::TEXT as farmer_name,
        COALESCE(pr.processing_date, sb.created_at::date)::DATE as processing_date,
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date)))::INTEGER as days_in_storage,
        CASE 
            WHEN EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old THEN 'Expired'::TEXT
            WHEN p_include_storage_issues AND (sl.status != 'active' OR sl.status IS NULL) THEN 'Storage Malfunction'::TEXT
            WHEN p_include_storage_issues AND sl.current_usage_kg > sl.capacity_kg THEN 'Storage Overcapacity'::TEXT
            ELSE 'Quality Issues'::TEXT
        END as disposal_reason,
        CASE 
            WHEN EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old THEN 
                ('Item is ' || EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date)))::INTEGER || ' days old')::TEXT
            WHEN p_include_storage_issues AND (sl.status != 'active' OR sl.status IS NULL) THEN 
                'Storage location is inactive or malfunctioning'::TEXT
            WHEN p_include_storage_issues AND sl.current_usage_kg > sl.capacity_kg THEN 
                'Storage location is over capacity'::TEXT
            ELSE 'Quality issues detected'::TEXT
        END as quality_notes
    FROM sorting_results sr
    JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
    JOIN processing_records pr ON sb.processing_record_id = pr.id
    JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
    JOIN farmers f ON we.farmer_id = f.id
    WHERE sb.status = 'completed'
    AND sr.storage_location_id IS NOT NULL
    AND sr.total_pieces > 0
    AND (
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old
        OR
        (p_include_storage_issues AND (
            sl.status != 'active' OR 
            sl.status IS NULL OR
            sl.current_usage_kg > sl.capacity_kg
        ))
    )
    ORDER BY days_in_storage DESC, sr.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_inventory_for_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_for_disposal TO anon;

SELECT 'get_inventory_for_disposal function fixed successfully!' as status;

