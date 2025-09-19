-- Create inventory aggregation from sorting data
-- This function aggregates total quantities by size from completed sorting batches

-- 1. Create function to get inventory summary aggregated from sorting batches
CREATE OR REPLACE FUNCTION get_inventory_from_sorting_batches()
RETURNS TABLE(
    size INTEGER,
    total_quantity INTEGER,
    total_weight_kg DECIMAL(10,2),
    batch_count INTEGER,
    storage_locations JSONB,
    contributing_batches JSONB
) AS $$
BEGIN
    RETURN QUERY 
    WITH size_aggregation AS (
        SELECT 
            size_key::INTEGER as size,
            SUM(quantity) as total_quantity,
            SUM(weight_kg) as total_weight_kg,
            COUNT(DISTINCT batch_id) as batch_count,
            jsonb_agg(
                jsonb_build_object(
                    'batch_id', batch_id,
                    'batch_number', batch_number,
                    'quantity', quantity,
                    'weight_kg', weight_kg,
                    'storage_location_id', storage_location_id,
                    'storage_location_name', storage_location_name,
                    'farmer_name', farmer_name,
                    'processing_date', processing_date,
                    'created_at', created_at
                ) ORDER BY created_at DESC
            ) as contributing_batches,
            jsonb_object_agg(
                storage_location_id::TEXT,
                jsonb_build_object(
                    'storage_location_name', storage_location_name,
                    'quantity', quantity,
                    'weight_kg', weight_kg
                )
            ) as storage_locations
        FROM (
            SELECT 
                sb.id as batch_id,
                sb.batch_number,
                sb.created_at,
                sb.storage_location_id,
                sl.name as storage_location_name,
                pr.processing_date,
                f.name as farmer_name,
                jsonb_each_text(sb.size_distribution) as size_entry
            FROM sorting_batches sb
            JOIN processing_records pr ON sb.processing_record_id = pr.id
            JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
            JOIN farmers f ON we.farmer_id = f.id
            LEFT JOIN storage_locations sl ON sb.storage_location_id = sl.id
            WHERE sb.status = 'completed'
            AND sb.size_distribution IS NOT NULL
            AND sb.size_distribution != '{}'::JSONB
        ) batch_data,
        LATERAL (
            SELECT 
                (batch_data.size_entry).key as size_key,
                (batch_data.size_entry).value::INTEGER as quantity,
                -- Estimate weight based on size (you can adjust these values)
                (batch_data.size_entry).value::INTEGER * CASE (batch_data.size_entry).key::INTEGER
                    WHEN 0 THEN 0.2  -- Small fish
                    WHEN 1 THEN 0.3
                    WHEN 2 THEN 0.4
                    WHEN 3 THEN 0.5
                    WHEN 4 THEN 0.6
                    WHEN 5 THEN 0.7
                    WHEN 6 THEN 0.8
                    WHEN 7 THEN 0.9
                    WHEN 8 THEN 1.0
                    WHEN 9 THEN 1.1
                    WHEN 10 THEN 1.2  -- Large fish
                    ELSE 0.5
                END as weight_kg
        ) size_data
        WHERE size_data.quantity > 0
        GROUP BY size_key::INTEGER
    )
    SELECT 
        sa.size,
        sa.total_quantity,
        sa.total_weight_kg,
        sa.batch_count,
        sa.storage_locations,
        sa.contributing_batches
    FROM size_aggregation sa
    ORDER BY sa.size;
END;
$$ LANGUAGE plpgsql;

-- 2. Create function to get inventory by storage location with size aggregation
CREATE OR REPLACE FUNCTION get_inventory_by_storage_from_sorting()
RETURNS TABLE(
    storage_location_id UUID,
    storage_location_name TEXT,
    size INTEGER,
    total_quantity INTEGER,
    total_weight_kg DECIMAL(10,2),
    batch_count INTEGER,
    contributing_batches JSONB
) AS $$
BEGIN
    RETURN QUERY 
    WITH storage_size_aggregation AS (
        SELECT 
            sb.storage_location_id,
            sl.name as storage_location_name,
            size_key::INTEGER as size,
            SUM(quantity) as total_quantity,
            SUM(weight_kg) as total_weight_kg,
            COUNT(DISTINCT sb.id) as batch_count,
            jsonb_agg(
                jsonb_build_object(
                    'batch_id', sb.id,
                    'batch_number', sb.batch_number,
                    'quantity', quantity,
                    'weight_kg', weight_kg,
                    'farmer_name', f.name,
                    'processing_date', pr.processing_date,
                    'created_at', sb.created_at
                ) ORDER BY sb.created_at DESC
            ) as contributing_batches
        FROM sorting_batches sb
        JOIN processing_records pr ON sb.processing_record_id = pr.id
        JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
        JOIN farmers f ON we.farmer_id = f.id
        LEFT JOIN storage_locations sl ON sb.storage_location_id = sl.id
        CROSS JOIN LATERAL (
            SELECT 
                (jsonb_each_text(sb.size_distribution)).key as size_key,
                (jsonb_each_text(sb.size_distribution)).value::INTEGER as quantity,
                -- Estimate weight based on size
                (jsonb_each_text(sb.size_distribution)).value::INTEGER * CASE (jsonb_each_text(sb.size_distribution)).key::INTEGER
                    WHEN 0 THEN 0.2
                    WHEN 1 THEN 0.3
                    WHEN 2 THEN 0.4
                    WHEN 3 THEN 0.5
                    WHEN 4 THEN 0.6
                    WHEN 5 THEN 0.7
                    WHEN 6 THEN 0.8
                    WHEN 7 THEN 0.9
                    WHEN 8 THEN 1.0
                    WHEN 9 THEN 1.1
                    WHEN 10 THEN 1.2
                    ELSE 0.5
                END as weight_kg
        ) size_data
        WHERE sb.status = 'completed'
        AND sb.size_distribution IS NOT NULL
        AND sb.size_distribution != '{}'::JSONB
        AND size_data.quantity > 0
        GROUP BY sb.storage_location_id, sl.name, size_key::INTEGER
    )
    SELECT 
        ssa.storage_location_id,
        ssa.storage_location_name,
        ssa.size,
        ssa.total_quantity,
        ssa.total_weight_kg,
        ssa.batch_count,
        ssa.contributing_batches
    FROM storage_size_aggregation ssa
    ORDER BY ssa.storage_location_name, ssa.size;
END;
$$ LANGUAGE plpgsql;

-- 3. Create function to get detailed batch information for a specific size
CREATE OR REPLACE FUNCTION get_batches_for_size(p_size INTEGER)
RETURNS TABLE(
    batch_id UUID,
    batch_number TEXT,
    quantity INTEGER,
    weight_kg DECIMAL(10,2),
    storage_location_id UUID,
    storage_location_name TEXT,
    farmer_name TEXT,
    farmer_phone TEXT,
    processing_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    total_batch_weight DECIMAL(10,2),
    size_distribution JSONB
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        sb.id as batch_id,
        sb.batch_number,
        (sb.size_distribution->>p_size::TEXT)::INTEGER as quantity,
        (sb.size_distribution->>p_size::TEXT)::INTEGER * CASE p_size
            WHEN 0 THEN 0.2
            WHEN 1 THEN 0.3
            WHEN 2 THEN 0.4
            WHEN 3 THEN 0.5
            WHEN 4 THEN 0.6
            WHEN 5 THEN 0.7
            WHEN 6 THEN 0.8
            WHEN 7 THEN 0.9
            WHEN 8 THEN 1.0
            WHEN 9 THEN 1.1
            WHEN 10 THEN 1.2
            ELSE 0.5
        END as weight_kg,
        sb.storage_location_id,
        sl.name as storage_location_name,
        f.name as farmer_name,
        f.phone as farmer_phone,
        pr.processing_date,
        sb.created_at,
        sb.total_weight_grams / 1000.0 as total_batch_weight,
        sb.size_distribution
    FROM sorting_batches sb
    JOIN processing_records pr ON sb.processing_record_id = pr.id
    JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
    JOIN farmers f ON we.farmer_id = f.id
    LEFT JOIN storage_locations sl ON sb.storage_location_id = sl.id
    WHERE sb.status = 'completed'
    AND sb.size_distribution IS NOT NULL
    AND sb.size_distribution != '{}'::JSONB
    AND (sb.size_distribution->>p_size::TEXT)::INTEGER > 0
    ORDER BY sb.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_inventory_from_sorting_batches TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_from_sorting_batches TO anon;
GRANT EXECUTE ON FUNCTION get_inventory_by_storage_from_sorting TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_by_storage_from_sorting TO anon;
GRANT EXECUTE ON FUNCTION get_batches_for_size TO authenticated;
GRANT EXECUTE ON FUNCTION get_batches_for_size TO anon;
