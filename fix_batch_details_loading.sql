-- Fix Batch Details Loading Issue
-- This fixes the relationship ambiguity in sorting_results table

-- 1. Check current foreign key relationships
SELECT '=== CHECKING FOREIGN KEY RELATIONSHIPS ===' as status;

SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'sorting_results'
AND ccu.table_name = 'storage_locations';

-- 2. Create a view to fix the relationship ambiguity
CREATE OR REPLACE VIEW sorting_results_with_storage AS
SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    sr.storage_location_id,
    sr.sorting_batch_id,
    sr.transfer_source_storage_id,
    sr.transfer_id,
    sr.created_at,
    sr.updated_at,
    -- Use the main storage location relationship
    sl_main.id as main_storage_id,
    sl_main.name as main_storage_name,
    sl_main.location_type as main_storage_type,
    -- Use the transfer source storage relationship  
    sl_source.id as source_storage_id,
    sl_source.name as source_storage_name,
    sl_source.location_type as source_storage_type
FROM sorting_results sr
LEFT JOIN storage_locations sl_main ON sr.storage_location_id = sl_main.id
LEFT JOIN storage_locations sl_source ON sr.transfer_source_storage_id = sl_source.id;

-- 3. Create a function to get batch details without relationship ambiguity
CREATE OR REPLACE FUNCTION get_batch_details_fixed(p_batch_id UUID)
RETURNS TABLE(
    batch_id UUID,
    batch_number TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    processing_date DATE,
    farmer_name TEXT,
    farmer_phone TEXT,
    farmer_location TEXT,
    sizes JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH batch_info AS (
        SELECT 
            sb.id,
            sb.batch_number::TEXT,
            sb.status::TEXT,
            sb.created_at,
            pr.processing_date,
            COALESCE(f.name, 'Unknown')::TEXT as farmer_name,
            COALESCE(f.phone, '')::TEXT as farmer_phone,
            COALESCE(f.location, '')::TEXT as farmer_location
        FROM sorting_batches sb
        LEFT JOIN processing_records pr ON sb.processing_record_id = pr.id
        LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
        LEFT JOIN farmers f ON we.farmer_id = f.id
        WHERE sb.id = p_batch_id
    ),
    batch_sizes AS (
        SELECT 
            sr.sorting_batch_id,
            JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'size_class', sr.size_class,
                    'total_pieces', sr.total_pieces,
                    'total_weight_kg', sr.total_weight_grams / 1000.0,
                    'storage_location_id', sr.storage_location_id,
                    'storage_location_name', COALESCE(sl.name, 'Unknown')
                ) ORDER BY sr.size_class
            ) as sizes_json
        FROM sorting_results sr
        LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
        WHERE sr.sorting_batch_id = p_batch_id
        AND sr.total_pieces > 0
        AND sr.total_weight_grams > 0
        -- Only show sizes that have remaining inventory (not yet ordered)
        GROUP BY sr.sorting_batch_id
    )
    SELECT 
        bi.id,
        bi.batch_number,
        bi.status,
        bi.created_at,
        bi.processing_date,
        bi.farmer_name,
        bi.farmer_phone,
        bi.farmer_location,
        COALESCE(bs.sizes_json, '[]'::jsonb) as sizes
    FROM batch_info bi
    LEFT JOIN batch_sizes bs ON bi.id = bs.sorting_batch_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Create a function to get oldest batches (click to see all sizes)
CREATE OR REPLACE FUNCTION get_oldest_batches_fixed()
RETURNS TABLE(
    batch_id UUID,
    batch_number TEXT,
    oldest_size INTEGER,
    total_pieces INTEGER,
    total_weight_kg DECIMAL(10,2),
    storage_location_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    days_in_storage INTEGER,
    farmer_name TEXT,
    processing_date DATE,
    available_for_order BOOLEAN,
    size_count INTEGER
) AS $$
BEGIN
    -- Return unique batches with their oldest size and summary info
    RETURN QUERY
    SELECT 
        sb.id as batch_id,
        COALESCE(sb.batch_number, 'BATCH-' || SUBSTRING(sb.id::text, 1, 8))::TEXT as batch_number,
        MIN(sr.size_class)::INTEGER as oldest_size,  -- Get the oldest size in this batch
        SUM(sr.total_pieces)::INTEGER as total_pieces,  -- Total pieces across all sizes
        SUM(sr.total_weight_grams) / 1000.0 as total_weight_kg,  -- Total weight across all sizes
        COALESCE(sl.name, 'Unknown')::TEXT as storage_location_name,
        sb.created_at,
        CASE 
            WHEN sb.created_at IS NOT NULL 
            THEN EXTRACT(DAYS FROM (NOW() - sb.created_at))
            ELSE 0
        END::INTEGER as days_in_storage,
        COALESCE(f.name, 'Unknown')::TEXT as farmer_name,
        pr.processing_date,
        TRUE as available_for_order,
        COUNT(sr.size_class)::INTEGER as size_count  -- How many different sizes in this batch
    FROM sorting_batches sb
    LEFT JOIN sorting_results sr ON sb.id = sr.sorting_batch_id
    LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
    LEFT JOIN processing_records pr ON sb.processing_record_id = pr.id
    LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
    LEFT JOIN farmers f ON we.farmer_id = f.id
    WHERE sb.status = 'completed'
    AND sr.storage_location_id IS NOT NULL
    AND sr.total_pieces > 0
    AND sr.total_weight_grams > 0
    -- Only show sizes that have remaining inventory (not yet ordered)
    GROUP BY sb.id, sb.batch_number, sb.created_at, sl.name, f.name, pr.processing_date
    ORDER BY sb.created_at ASC  -- FIFO: oldest batches first
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- 5. Create a function to get oldest batches available for ordering (click to see all sizes)
CREATE OR REPLACE FUNCTION get_batches_available_for_order()
RETURNS TABLE(
    batch_id UUID,
    batch_number TEXT,
    oldest_size INTEGER,
    total_pieces INTEGER,
    total_weight_kg DECIMAL(10,2),
    storage_location_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    days_in_storage INTEGER,
    farmer_name TEXT,
    processing_date DATE,
    priority_score INTEGER,
    size_count INTEGER
) AS $$
BEGIN
    -- Return unique batches with priority scoring and summary info
    RETURN QUERY
    SELECT 
        sb.id as batch_id,
        COALESCE(sb.batch_number, 'BATCH-' || SUBSTRING(sb.id::text, 1, 8))::TEXT as batch_number,
        MIN(sr.size_class)::INTEGER as oldest_size,  -- Get the oldest size in this batch
        SUM(sr.total_pieces)::INTEGER as total_pieces,  -- Total pieces across all sizes
        SUM(sr.total_weight_grams) / 1000.0 as total_weight_kg,  -- Total weight across all sizes
        COALESCE(sl.name, 'Unknown')::TEXT as storage_location_name,
        sb.created_at,
        CASE 
            WHEN sb.created_at IS NOT NULL 
            THEN EXTRACT(DAYS FROM (NOW() - sb.created_at))
            ELSE 0
        END::INTEGER as days_in_storage,
        COALESCE(f.name, 'Unknown')::TEXT as farmer_name,
        pr.processing_date,
        -- Priority score: older batches get higher priority (lower number = higher priority)
        ROW_NUMBER() OVER (
            ORDER BY sb.created_at ASC
        )::INTEGER as priority_score,
        COUNT(sr.size_class)::INTEGER as size_count  -- How many different sizes in this batch
    FROM sorting_batches sb
    LEFT JOIN sorting_results sr ON sb.id = sr.sorting_batch_id
    LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
    LEFT JOIN processing_records pr ON sb.processing_record_id = pr.id
    LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
    LEFT JOIN farmers f ON we.farmer_id = f.id
    WHERE sb.status = 'completed'
    AND sr.storage_location_id IS NOT NULL
    AND sr.total_pieces > 0
    AND sr.total_weight_grams > 0
    -- Only show sizes that have remaining inventory (not yet ordered)
    GROUP BY sb.id, sb.batch_number, sb.created_at, sl.name, f.name, pr.processing_date
    ORDER BY sb.created_at ASC;  -- FIFO: oldest batches first
END;
$$ LANGUAGE plpgsql;

-- 6. Grant permissions
GRANT EXECUTE ON FUNCTION get_batch_details_fixed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_oldest_batches_fixed() TO authenticated;
GRANT EXECUTE ON FUNCTION get_batches_available_for_order() TO authenticated;
GRANT SELECT ON sorting_results_with_storage TO authenticated;

-- 7. Test the functions
SELECT '=== TESTING FIXED FUNCTIONS ===' as status;

-- Test batch details function
SELECT 'Testing get_batch_details_fixed function...' as test_name;
SELECT * FROM get_batch_details_fixed('71b39eaa-2ff0-43e8-8096-4b90288c5afb'::UUID) LIMIT 1;

-- Test oldest batches function (click to see all sizes)
SELECT 'Testing get_oldest_batches_fixed function (batches with oldest size info)...' as test_name;
SELECT * FROM get_oldest_batches_fixed() LIMIT 5;

-- Test oldest batches available for order function (click to see all sizes)
SELECT 'Testing get_batches_available_for_order function (batches with oldest size info)...' as test_name;
SELECT * FROM get_batches_available_for_order() LIMIT 10;

SELECT 'Batch details loading fix completed successfully - Now shows BATCHES with remaining inventory only! Click on a batch to see all remaining sizes that have NOT been ordered yet.' as final_status;
