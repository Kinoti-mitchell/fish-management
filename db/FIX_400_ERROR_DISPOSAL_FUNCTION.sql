-- Fix for 400 Error with get_inventory_for_disposal Function
-- This addresses the 400 error you're getting when calling the function

-- First, let's check if the function exists and what parameters it expects
SELECT '=== CHECKING EXISTING FUNCTION ===' as section;
SELECT 
    routine_name,
    routine_type,
    data_type,
    parameter_name,
    parameter_mode,
    data_type as parameter_type
FROM information_schema.routines r
LEFT JOIN information_schema.parameters p ON r.specific_name = p.specific_name
WHERE r.routine_schema = 'public' 
AND r.routine_name = 'get_inventory_for_disposal'
ORDER BY p.ordinal_position;

-- Drop the function if it exists (to recreate it properly)
DROP FUNCTION IF EXISTS get_inventory_for_disposal(INTEGER, BOOLEAN);

-- Recreate the function with proper parameter handling
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
        COALESCE(sb.batch_number, 'BATCH-' || SUBSTRING(sb.id::text, 1, 8)) as batch_number,
        COALESCE(sl.name, 'Unknown Storage') as storage_location_name,
        COALESCE(f.name, 'Unknown Farmer') as farmer_name,
        COALESCE(pr.processing_date, sb.created_at::date) as processing_date,
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date)))::INTEGER as days_in_storage,
        CASE 
            WHEN EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old THEN 'Expired'
            WHEN p_include_storage_issues AND sl.status = 'inactive' THEN 'Storage Inactive'
            WHEN p_include_storage_issues AND sl.status = 'maintenance' THEN 'Storage Maintenance'
            WHEN p_include_storage_issues AND sl.current_usage_kg > sl.capacity_kg THEN 'Storage Overcapacity'
            ELSE 'Quality Issues'
        END as disposal_reason,
        CASE 
            WHEN EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old THEN 
                'Fish older than ' || p_days_old || ' days - expired'
            WHEN p_include_storage_issues AND sl.status = 'inactive' THEN 
                'Storage location is inactive - ' || COALESCE(sl.name, 'Unknown') || ' - requires immediate disposal'
            WHEN p_include_storage_issues AND sl.status = 'maintenance' THEN 
                'Storage location under maintenance - ' || COALESCE(sl.name, 'Unknown') || ' - requires disposal'
            WHEN p_include_storage_issues AND sl.current_usage_kg > sl.capacity_kg THEN 
                'Storage overcapacity - ' || COALESCE(sl.name, 'Unknown')
            ELSE 'Quality issues detected'
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

-- Test the function with different parameter combinations
SELECT '=== TESTING FUNCTION WITH DEFAULT PARAMETERS ===' as section;
SELECT 
    batch_number,
    storage_location_name,
    farmer_name,
    processing_date,
    days_in_storage,
    disposal_reason,
    total_pieces,
    ROUND(total_weight_grams / 1000.0, 2) as weight_kg
FROM get_inventory_for_disposal()
LIMIT 5;

SELECT '=== TESTING FUNCTION WITH EXPLICIT PARAMETERS ===' as section;
SELECT 
    batch_number,
    storage_location_name,
    farmer_name,
    processing_date,
    days_in_storage,
    disposal_reason,
    total_pieces,
    ROUND(total_weight_grams / 1000.0, 2) as weight_kg
FROM get_inventory_for_disposal(30, true)
LIMIT 5;

SELECT '=== TESTING FUNCTION WITH NULL PARAMETERS ===' as section;
SELECT 
    batch_number,
    storage_location_name,
    farmer_name,
    processing_date,
    days_in_storage,
    disposal_reason,
    total_pieces,
    ROUND(total_weight_grams / 1000.0, 2) as weight_kg
FROM get_inventory_for_disposal(NULL, NULL)
LIMIT 5;

-- Check if there are any missing tables that might cause the 400 error
SELECT '=== CHECKING REQUIRED TABLES ===' as section;
SELECT 
    table_name,
    CASE WHEN table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('sorting_results', 'sorting_batches', 'storage_locations', 'processing_records', 'warehouse_entries', 'farmers', 'disposal_items', 'disposal_records');

SELECT 'Function recreated successfully! The 400 error should be fixed.' as status;

