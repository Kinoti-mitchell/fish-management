-- Hierarchical Disposal Data Functions
-- Functions to get disposal data in a hierarchical structure: Storage → Batch → Size Classes

-- 1. Function to get storage locations with disposal summary
CREATE OR REPLACE FUNCTION get_storage_disposal_summary(
    p_days_old INTEGER DEFAULT 30,
    p_include_storage_issues BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
    storage_location_id UUID,
    storage_location_name TEXT,
    storage_status TEXT,
    storage_capacity_kg DECIMAL(10,2),
    storage_current_usage_kg DECIMAL(10,2),
    total_batches INTEGER,
    total_pieces INTEGER,
    total_weight_kg DECIMAL(10,2),
    disposal_reasons TEXT[],
    has_storage_issues BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sl.id as storage_location_id,
        sl.name as storage_location_name,
        sl.status as storage_status,
        sl.capacity_kg as storage_capacity_kg,
        sl.current_usage_kg as storage_current_usage_kg,
        COUNT(DISTINCT sb.batch_number)::INTEGER as total_batches,
        SUM(sr.total_pieces)::INTEGER as total_pieces,
        ROUND(SUM(sr.total_weight_grams) / 1000.0, 2) as total_weight_kg,
        ARRAY_AGG(DISTINCT 
            CASE 
                WHEN EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old THEN 'Expired'
                WHEN p_include_storage_issues AND sl.status != 'active' THEN 'Storage Inactive'
                WHEN p_include_storage_issues AND sl.current_usage_kg > sl.capacity_kg THEN 'Storage Overcapacity'
                ELSE 'Quality Issues'
            END
        ) as disposal_reasons,
        (sl.status != 'active' OR sl.current_usage_kg > sl.capacity_kg) as has_storage_issues
    FROM storage_locations sl
    JOIN sorting_results sr ON sl.id = sr.storage_location_id
    JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    JOIN processing_records pr ON sb.processing_record_id = pr.id
    WHERE sb.status = 'completed'
    AND sr.total_pieces > 0
    AND (
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old
        OR 
        (p_include_storage_issues AND (
            sl.status != 'active' OR 
            sl.current_usage_kg > sl.capacity_kg
        ))
    )
    -- Exclude items already in pending/approved disposal records
    AND NOT EXISTS (
        SELECT 1 FROM disposal_items di 
        JOIN disposal_records dr ON di.disposal_record_id = dr.id
        WHERE di.sorting_result_id = sr.id 
        AND dr.status IN ('pending', 'approved')
    )
    GROUP BY sl.id, sl.name, sl.status, sl.capacity_kg, sl.current_usage_kg
    ORDER BY 
        CASE WHEN sl.status != 'active' THEN 1 ELSE 2 END,
        CASE WHEN sl.current_usage_kg > sl.capacity_kg THEN 1 ELSE 2 END,
        SUM(sr.total_weight_grams) DESC;
END;
$$ LANGUAGE plpgsql;

-- 2. Function to get batches for a specific storage location
CREATE OR REPLACE FUNCTION get_batch_disposal_summary(
    p_storage_location_id UUID,
    p_days_old INTEGER DEFAULT 30,
    p_include_storage_issues BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
    batch_id UUID,
    batch_number TEXT,
    farmer_name TEXT,
    processing_date DATE,
    days_in_storage INTEGER,
    total_size_classes INTEGER,
    total_pieces INTEGER,
    total_weight_kg DECIMAL(10,2),
    disposal_reasons TEXT[],
    is_expired BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sb.id as batch_id,
        COALESCE(sb.batch_number, 'BATCH-' || SUBSTRING(sb.id::text, 1, 8)) as batch_number,
        f.name as farmer_name,
        COALESCE(pr.processing_date, sb.created_at::date) as processing_date,
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date)))::INTEGER as days_in_storage,
        COUNT(DISTINCT sr.size_class)::INTEGER as total_size_classes,
        SUM(sr.total_pieces)::INTEGER as total_pieces,
        ROUND(SUM(sr.total_weight_grams) / 1000.0, 2) as total_weight_kg,
        ARRAY_AGG(DISTINCT 
            CASE 
                WHEN EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old THEN 'Expired'
                WHEN p_include_storage_issues AND sl.status != 'active' THEN 'Storage Inactive'
                WHEN p_include_storage_issues AND sl.current_usage_kg > sl.capacity_kg THEN 'Storage Overcapacity'
                ELSE 'Quality Issues'
            END
        ) as disposal_reasons,
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old as is_expired
    FROM sorting_batches sb
    JOIN sorting_results sr ON sb.id = sr.sorting_batch_id
    JOIN storage_locations sl ON sr.storage_location_id = sl.id
    JOIN processing_records pr ON sb.processing_record_id = pr.id
    JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
    JOIN farmers f ON we.farmer_id = f.id
    WHERE sb.status = 'completed'
    AND sr.storage_location_id = p_storage_location_id
    AND sr.total_pieces > 0
    AND (
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old
        OR 
        (p_include_storage_issues AND (
            sl.status != 'active' OR 
            sl.current_usage_kg > sl.capacity_kg
        ))
    )
    -- Exclude items already in pending/approved disposal records
    AND NOT EXISTS (
        SELECT 1 FROM disposal_items di 
        JOIN disposal_records dr ON di.disposal_record_id = dr.id
        WHERE di.sorting_result_id = sr.id 
        AND dr.status IN ('pending', 'approved')
    )
    GROUP BY sb.id, sb.batch_number, f.name, pr.processing_date, sb.created_at, sl.status, sl.current_usage_kg
    ORDER BY 
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) DESC,
        SUM(sr.total_weight_grams) DESC;
END;
$$ LANGUAGE plpgsql;

-- 3. Function to get size classes for a specific batch
CREATE OR REPLACE FUNCTION get_size_class_disposal_details(
    p_batch_id UUID,
    p_days_old INTEGER DEFAULT 30,
    p_include_storage_issues BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
    sorting_result_id UUID,
    size_class INTEGER,
    pieces INTEGER,
    weight_kg DECIMAL(10,2),
    disposal_reason TEXT,
    quality_notes TEXT,
    days_in_storage INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sr.id as sorting_result_id,
        sr.size_class,
        sr.total_pieces as pieces,
        ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
        CASE 
            WHEN EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old THEN 'Expired'
            WHEN p_include_storage_issues AND sl.status != 'active' THEN 'Storage Inactive'
            WHEN p_include_storage_issues AND sl.current_usage_kg > sl.capacity_kg THEN 'Storage Overcapacity'
            ELSE 'Quality Issues'
        END as disposal_reason,
        CASE 
            WHEN EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old THEN 
                'Fish older than ' || p_days_old || ' days - expired'
            WHEN p_include_storage_issues AND sl.status != 'active' THEN 
                'Storage location is not active - ' || COALESCE(sl.name, 'Unknown')
            WHEN p_include_storage_issues AND sl.current_usage_kg > sl.capacity_kg THEN 
                'Storage overcapacity - ' || COALESCE(sl.name, 'Unknown')
            ELSE 'Quality issues detected'
        END as quality_notes,
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date)))::INTEGER as days_in_storage
    FROM sorting_results sr
    JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    JOIN storage_locations sl ON sr.storage_location_id = sl.id
    JOIN processing_records pr ON sb.processing_record_id = pr.id
    WHERE sb.id = p_batch_id
    AND sb.status = 'completed'
    AND sr.total_pieces > 0
    AND (
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old
        OR 
        (p_include_storage_issues AND (
            sl.status != 'active' OR 
            sl.current_usage_kg > sl.capacity_kg
        ))
    )
    -- Exclude items already in pending/approved disposal records
    AND NOT EXISTS (
        SELECT 1 FROM disposal_items di 
        JOIN disposal_records dr ON di.disposal_record_id = dr.id
        WHERE di.sorting_result_id = sr.id 
        AND dr.status IN ('pending', 'approved')
    )
    ORDER BY sr.size_class;
END;
$$ LANGUAGE plpgsql;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION get_storage_disposal_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_batch_disposal_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_size_class_disposal_details TO authenticated;

-- 5. Test the functions
SELECT 'Hierarchical disposal functions created successfully!' as status;

-- Test storage summary
SELECT '=== STORAGE DISPOSAL SUMMARY ===' as test;
SELECT 
    storage_location_name,
    storage_status,
    total_batches,
    total_pieces,
    total_weight_kg,
    disposal_reasons,
    has_storage_issues
FROM get_storage_disposal_summary(30, true)
LIMIT 3;
