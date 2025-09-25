-- Create inventory system with size aggregation and batch tracking
-- This implements: Storage → Sizes within Storage → Add to existing size → Track batches

-- 1. Create function to get inventory by storage location with size aggregation
CREATE OR REPLACE FUNCTION get_inventory_by_storage_with_sizes()
RETURNS TABLE(
    storage_location_id UUID,
    storage_location_name TEXT,
    size INTEGER,
    total_quantity INTEGER,
    total_weight_kg DECIMAL(10,2),
    average_weight_per_fish DECIMAL(6,3),
    last_updated TIMESTAMP WITH TIME ZONE,
    batch_count INTEGER,
    contributing_batches JSONB
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        i.storage_location_id,
        sl.name as storage_location_name,
        i.size,
        i.quantity as total_quantity,
        i.total_weight_kg,
        i.average_weight_per_fish,
        i.last_updated,
        COALESCE(batch_info.batch_count, 0) as batch_count,
        COALESCE(batch_info.contributing_batches, '[]'::JSONB) as contributing_batches
    FROM inventory_with_storage i
    JOIN storage_locations sl ON i.storage_location_id = sl.id
    LEFT JOIN (
        SELECT 
            ies.storage_location_id,
            ies.size,
            COUNT(DISTINCT ies.reference_id) as batch_count,
            jsonb_agg(
                jsonb_build_object(
                    'batch_id', ies.reference_id,
                    'batch_number', sb.batch_number,
                    'quantity_added', ies.quantity_change,
                    'added_date', ies.created_at,
                    'farmer_name', pr.warehouse_entry.farmers.name,
                    'processing_date', pr.processing_date
                ) ORDER BY ies.created_at DESC
            ) FILTER (WHERE ies.entry_type = 'sorting' AND ies.quantity_change > 0) as contributing_batches
        FROM inventory_entries_with_storage ies
        LEFT JOIN sorting_batches sb ON ies.reference_id = sb.id
        LEFT JOIN processing_records pr ON sb.processing_record_id = pr.id
        LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
        LEFT JOIN farmers f ON we.farmer_id = f.id
        WHERE ies.entry_type = 'sorting' AND ies.quantity_change > 0
        GROUP BY ies.storage_location_id, ies.size
    ) batch_info ON i.storage_location_id = batch_info.storage_location_id AND i.size = batch_info.size
    WHERE i.quantity > 0 AND sl.status = 'active'
    ORDER BY sl.name, i.size;
END;
$$ LANGUAGE plpgsql;

-- 2. Create function to get detailed batch information for a specific size in a storage location
CREATE OR REPLACE FUNCTION get_batches_for_size_in_storage(
    p_storage_location_id UUID,
    p_size INTEGER
)
RETURNS TABLE(
    batch_id UUID,
    batch_number TEXT,
    quantity_added INTEGER,
    added_date TIMESTAMP WITH TIME ZONE,
    farmer_name TEXT,
    farmer_phone TEXT,
    farmer_location TEXT,
    processing_date TIMESTAMP WITH TIME ZONE,
    total_batch_weight DECIMAL(10,2),
    size_distribution JSONB,
    processing_record_id UUID,
    warehouse_entry_id UUID
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        sb.id as batch_id,
        sb.batch_number,
        ies.quantity_change as quantity_added,
        ies.created_at as added_date,
        f.name as farmer_name,
        f.phone as farmer_phone,
        f.location as farmer_location,
        pr.processing_date,
        sb.total_weight as total_batch_weight,
        sb.size_distribution,
        pr.id as processing_record_id,
        we.id as warehouse_entry_id
    FROM inventory_entries_with_storage ies
    JOIN sorting_batches sb ON ies.reference_id = sb.id
    JOIN processing_records pr ON sb.processing_record_id = pr.id
    JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
    JOIN farmers f ON we.farmer_id = f.id
    WHERE ies.storage_location_id = p_storage_location_id
    AND ies.size = p_size
    AND ies.entry_type = 'sorting'
    AND ies.quantity_change > 0
    ORDER BY ies.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 3. Create function to get storage location summary with size breakdown
CREATE OR REPLACE FUNCTION get_storage_location_summary()
RETURNS TABLE(
    storage_location_id UUID,
    storage_location_name TEXT,
    location_type TEXT,
    capacity_kg DECIMAL(10,2),
    current_usage_kg DECIMAL(10,2),
    utilization_percent DECIMAL(5,2),
    total_fish_count INTEGER,
    size_breakdown JSONB,
    last_activity TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        sl.id as storage_location_id,
        sl.name as storage_location_name,
        sl.location_type,
        sl.capacity_kg,
        sl.current_usage_kg,
        CASE 
            WHEN sl.capacity_kg > 0 THEN ROUND((sl.current_usage_kg / sl.capacity_kg) * 100, 2)
            ELSE 0
        END as utilization_percent,
        COALESCE(inv_summary.total_fish_count, 0) as total_fish_count,
        COALESCE(inv_summary.size_breakdown, '{}'::JSONB) as size_breakdown,
        COALESCE(inv_summary.last_activity, sl.updated_at) as last_activity
    FROM storage_locations sl
    LEFT JOIN (
        SELECT 
            i.storage_location_id,
            SUM(i.quantity) as total_fish_count,
            jsonb_object_agg(
                i.size::TEXT,
                jsonb_build_object(
                    'quantity', i.quantity,
                    'weight_kg', i.total_weight_kg,
                    'avg_weight_per_fish', i.average_weight_per_fish,
                    'last_updated', i.last_updated
                )
            ) FILTER (WHERE i.quantity > 0) as size_breakdown,
            MAX(i.last_updated) as last_activity
        FROM inventory_with_storage i
        GROUP BY i.storage_location_id
    ) inv_summary ON sl.id = inv_summary.storage_location_id
    WHERE sl.status = 'active'
    ORDER BY sl.name;
END;
$$ LANGUAGE plpgsql;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION get_inventory_by_storage_with_sizes TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_by_storage_with_sizes TO anon;
GRANT EXECUTE ON FUNCTION get_batches_for_size_in_storage TO authenticated;
GRANT EXECUTE ON FUNCTION get_batches_for_size_in_storage TO anon;
GRANT EXECUTE ON FUNCTION get_storage_location_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_storage_location_summary TO anon;
