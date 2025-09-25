-- Remove piece counts from disposal system
-- Focus only on weights as requested

-- 1. Remove total_pieces column from disposal_records table
ALTER TABLE disposal_records DROP COLUMN IF EXISTS total_pieces;

-- 2. Remove quantity column from disposal_items table (this stores piece counts)
ALTER TABLE disposal_items DROP COLUMN IF EXISTS quantity;

-- 3. Update the get_inventory_for_disposal function to not return total_pieces
DROP FUNCTION IF EXISTS get_inventory_for_disposal(INTEGER, BOOLEAN);

CREATE OR REPLACE FUNCTION get_inventory_for_disposal(
    p_days_old INTEGER DEFAULT 30,
    p_include_storage_issues BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
    sorting_result_id UUID,
    size_class INTEGER,
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
    -- Validate input parameters
    IF p_days_old IS NULL THEN
        p_days_old := 30;
    END IF;
    
    IF p_include_storage_issues IS NULL THEN
        p_include_storage_issues := TRUE;
    END IF;

    RETURN QUERY
    SELECT 
        sr.id as sorting_result_id,
        sr.size_class,
        sr.total_weight_grams,
        COALESCE(sb.batch_number, 'BATCH-' || SUBSTRING(sb.id::text, 1, 8))::TEXT as batch_number,
        COALESCE(sl.name, 'Unknown Storage')::TEXT as storage_location_name,
        COALESCE(f.name, 'Unknown Farmer')::TEXT as farmer_name,
        COALESCE(pr.processing_date, sb.created_at::date) as processing_date,
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date)))::INTEGER as days_in_storage,
        (CASE 
            WHEN EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old THEN 'Expired'
            WHEN p_include_storage_issues AND sl.status = 'inactive' THEN 'Storage Inactive'
            WHEN p_include_storage_issues AND sl.status = 'maintenance' THEN 'Storage Maintenance'
            WHEN p_include_storage_issues AND sl.current_usage_kg > sl.capacity_kg THEN 'Storage Overcapacity'
            ELSE 'Quality Issues'
        END)::TEXT as disposal_reason,
        (CASE 
            WHEN EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old THEN 
                'Fish older than ' || p_days_old || ' days - expired'
            WHEN p_include_storage_issues AND sl.status = 'inactive' THEN 
                'Storage location is inactive - ' || COALESCE(sl.name, 'Unknown') || ' - requires immediate disposal'
            WHEN p_include_storage_issues AND sl.status = 'maintenance' THEN 
                'Storage location under maintenance - ' || COALESCE(sl.name, 'Unknown') || ' - requires disposal'
            WHEN p_include_storage_issues AND sl.current_usage_kg > sl.capacity_kg THEN 
                'Storage overcapacity - ' || COALESCE(sl.name, 'Unknown')
            ELSE 'Quality issues detected'
        END)::TEXT as quality_notes
    FROM sorting_results sr
    JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
    JOIN processing_records pr ON sb.processing_record_id = pr.id
    JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
    JOIN farmers f ON we.farmer_id = f.id
    WHERE sb.status = 'completed'
    AND sr.storage_location_id IS NOT NULL
    AND sr.total_weight_grams > 0  -- Only include items with weight > 0
    AND (
        -- Items older than specified days
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old
        OR 
        -- Storage issues (including inactive and maintenance status)
        (p_include_storage_issues AND (
            sl.status = 'inactive' OR 
            sl.status = 'maintenance' OR
            sl.current_usage_kg > sl.capacity_kg
        ))
    )
    -- Exclude items that are already in pending/approved disposal records
    AND NOT EXISTS (
        SELECT 1 FROM disposal_items di 
        JOIN disposal_records dr ON di.disposal_record_id = dr.id
        WHERE di.sorting_result_id = sr.id 
        AND dr.status IN ('pending', 'approved')
    )
    ORDER BY 
        -- Prioritize inactive storage items first
        CASE WHEN sl.status = 'inactive' THEN 1 ELSE 2 END,
        -- Then by maintenance items
        CASE WHEN sl.status = 'maintenance' THEN 1 ELSE 2 END,
        -- Then by age
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) DESC,
        -- Finally by weight
        sr.total_weight_grams DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_inventory_for_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_for_disposal TO anon;

-- Test the function
SELECT 'get_inventory_for_disposal function updated successfully - piece counts removed!' as status;
