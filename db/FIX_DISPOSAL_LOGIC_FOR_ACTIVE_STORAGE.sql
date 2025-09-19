-- Fix Disposal Logic to Properly Filter Active Storage
-- This ensures only items that should be disposed appear in disposal

-- Drop and recreate the function with stricter filtering
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
        sr.total_pieces,
        sr.total_weight_grams,
        -- Cast to TEXT to ensure proper data type
        COALESCE(sb.batch_number::TEXT, 'BATCH-' || SUBSTRING(sb.id::text, 1, 8)) as batch_number,
        COALESCE(sl.name::TEXT, 'Unknown Storage') as storage_location_name,
        COALESCE(f.name::TEXT, 'Unknown Farmer') as farmer_name,
        COALESCE(pr.processing_date, sb.created_at::date) as processing_date,
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date)))::INTEGER as days_in_storage,
        -- More specific disposal reasons
        CASE 
            WHEN EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old THEN 'Expired'::TEXT
            WHEN p_include_storage_issues AND sl.status = 'inactive' THEN 'Storage Inactive'::TEXT
            WHEN p_include_storage_issues AND sl.status = 'maintenance' THEN 'Storage Maintenance'::TEXT
            WHEN p_include_storage_issues AND sl.current_usage_kg > sl.capacity_kg THEN 'Storage Overcapacity'::TEXT
            ELSE 'Quality Issues'::TEXT
        END as disposal_reason,
        -- More detailed quality notes
        CASE 
            WHEN EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old THEN 
                ('Fish older than ' || p_days_old || ' days - expired')::TEXT
            WHEN p_include_storage_issues AND sl.status = 'inactive' THEN 
                ('Storage location is inactive - ' || COALESCE(sl.name, 'Unknown') || ' - requires immediate disposal')::TEXT
            WHEN p_include_storage_issues AND sl.status = 'maintenance' THEN 
                ('Storage location under maintenance - ' || COALESCE(sl.name, 'Unknown') || ' - requires disposal')::TEXT
            WHEN p_include_storage_issues AND sl.current_usage_kg > sl.capacity_kg THEN 
                ('Storage overcapacity - ' || COALESCE(sl.name, 'Unknown') || ' (' || ROUND(sl.current_usage_kg, 2) || 'kg / ' || ROUND(sl.capacity_kg, 2) || 'kg)')::TEXT
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
        -- Items older than specified days
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old
        OR 
        -- Storage issues (ONLY inactive, maintenance, or overcapacity)
        (p_include_storage_issues AND (
            sl.status = 'inactive' OR 
            sl.status = 'maintenance' OR
            (sl.current_usage_kg > sl.capacity_kg)
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
        -- Then by overcapacity
        CASE WHEN sl.current_usage_kg > sl.capacity_kg THEN 1 ELSE 2 END,
        -- Then by age
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) DESC,
        -- Finally by weight
        sr.total_weight_grams DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_inventory_for_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_for_disposal TO anon;

-- Test the fixed function
SELECT '=== TESTING FIXED DISPOSAL FUNCTION ===' as section;
SELECT 
    batch_number,
    storage_location_name,
    farmer_name,
    processing_date,
    days_in_storage,
    disposal_reason,
    total_pieces,
    ROUND(total_weight_grams / 1000.0, 2) as weight_kg,
    quality_notes
FROM get_inventory_for_disposal(30, true)
ORDER BY disposal_reason, storage_location_name, batch_number;

-- Check specifically for Cold Storage B items
SELECT '=== COLD STORAGE B ITEMS IN DISPOSAL ===' as section;
SELECT 
    batch_number,
    storage_location_name,
    farmer_name,
    processing_date,
    days_in_storage,
    disposal_reason,
    total_pieces,
    ROUND(total_weight_grams / 1000.0, 2) as weight_kg,
    quality_notes
FROM get_inventory_for_disposal(30, true)
WHERE storage_location_name = 'Cold Storage B'
ORDER BY disposal_reason, batch_number;

SELECT 'Disposal logic fixed! Active storage should no longer appear in disposal unless there are valid reasons.' as status;
