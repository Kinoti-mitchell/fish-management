-- Auto Disposal Functions
-- Functions to automatically identify and create disposal records for old/expired inventory

-- 1. Function to get inventory items that should be disposed
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
            WHEN p_include_storage_issues AND sl.status != 'active' THEN 'Storage Malfunction'
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
        -- Storage issues
        (p_include_storage_issues AND (
            sl.status != 'active' OR 
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
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) DESC,
        sr.total_weight_grams DESC;
END;
$$ LANGUAGE plpgsql;

-- 2. Function to create disposal record with auto-populated items
CREATE OR REPLACE FUNCTION create_auto_disposal(
    p_disposal_reason_id UUID,
    p_disposal_method TEXT DEFAULT 'waste',
    p_disposal_location TEXT DEFAULT NULL,
    p_disposal_cost DECIMAL(10,2) DEFAULT 0,
    p_notes TEXT DEFAULT NULL,
    p_disposed_by UUID DEFAULT NULL,
    p_days_old INTEGER DEFAULT 30,
    p_include_storage_issues BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
    disposal_id UUID,
    disposal_number TEXT,
    items_added INTEGER,
    total_weight_kg DECIMAL(10,2),
    total_pieces INTEGER,
    message TEXT
) AS $$
DECLARE
    v_disposal_id UUID;
    v_disposal_number TEXT;
    v_item RECORD;
    v_items_added INTEGER := 0;
    v_total_weight DECIMAL(10,2) := 0;
    v_total_pieces INTEGER := 0;
    v_disposal_reason_name TEXT;
BEGIN
    -- Get disposal reason name
    SELECT name INTO v_disposal_reason_name 
    FROM disposal_reasons 
    WHERE id = p_disposal_reason_id;
    
    IF v_disposal_reason_name IS NULL THEN
        RAISE EXCEPTION 'Disposal reason not found';
    END IF;
    
    -- Generate disposal number
    v_disposal_number := generate_disposal_number();
    
    -- Create disposal record
    INSERT INTO disposal_records (
        disposal_number,
        disposal_reason_id,
        disposal_method,
        disposal_location,
        disposal_cost,
        notes,
        disposed_by,
        status
    ) VALUES (
        v_disposal_number,
        p_disposal_reason_id,
        p_disposal_method,
        p_disposal_location,
        p_disposal_cost,
        COALESCE(p_notes, 'Auto-generated disposal for items older than ' || p_days_old || ' days'),
        p_disposed_by,
        'pending'
    ) RETURNING id INTO v_disposal_id;
    
    -- Add items to disposal
    FOR v_item IN
        SELECT * FROM get_inventory_for_disposal(p_days_old, p_include_storage_issues)
    LOOP
        -- Add disposal item
        INSERT INTO disposal_items (
            disposal_record_id,
            sorting_result_id,
            size_class,
            quantity,
            weight_kg,
            batch_number,
            storage_location_name,
            farmer_name,
            processing_date,
            quality_notes,
            disposal_reason
        ) VALUES (
            v_disposal_id,
            v_item.sorting_result_id,
            v_item.size_class,
            v_item.total_pieces,
            v_item.total_weight_grams / 1000.0,
            v_item.batch_number,
            v_item.storage_location_name,
            v_item.farmer_name,
            v_item.processing_date,
            v_item.quality_notes,
            v_item.disposal_reason
        );
        
        v_items_added := v_items_added + 1;
        v_total_weight := v_total_weight + (v_item.total_weight_grams / 1000.0);
        v_total_pieces := v_total_pieces + v_item.total_pieces;
    END LOOP;
    
    -- Update disposal record with totals
    UPDATE disposal_records
    SET total_weight_kg = v_total_weight,
        total_pieces = v_total_pieces,
        updated_at = NOW()
    WHERE id = v_disposal_id;
    
    -- Log audit
    INSERT INTO disposal_audit_log (disposal_record_id, action, new_values, performed_by, notes)
    VALUES (v_disposal_id, 'created', 
            jsonb_build_object(
                'disposal_number', v_disposal_number,
                'items_added', v_items_added,
                'total_weight_kg', v_total_weight,
                'total_pieces', v_total_pieces,
                'auto_generated', true
            ),
            p_disposed_by,
            'Auto-generated disposal for ' || v_items_added || ' items');
    
    -- Return results
    RETURN QUERY SELECT 
        v_disposal_id,
        v_disposal_number,
        v_items_added,
        v_total_weight,
        v_total_pieces,
        'Successfully created disposal with ' || v_items_added || ' items (' || 
        ROUND(v_total_weight, 2) || 'kg, ' || v_total_pieces || ' pieces)' as message;
END;
$$ LANGUAGE plpgsql;

-- 3. Function to get disposal summary by reason
CREATE OR REPLACE FUNCTION get_disposal_summary_by_reason(
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL
)
RETURNS TABLE(
    reason_name TEXT,
    disposal_count INTEGER,
    total_weight_kg DECIMAL(10,2),
    total_pieces INTEGER,
    total_cost DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dr.name as reason_name,
        COUNT(dr2.id)::INTEGER as disposal_count,
        COALESCE(SUM(dr2.total_weight_kg), 0) as total_weight_kg,
        COALESCE(SUM(dr2.total_pieces), 0) as total_pieces,
        COALESCE(SUM(dr2.disposal_cost), 0) as total_cost
    FROM disposal_reasons dr
    LEFT JOIN disposal_records dr2 ON dr.id = dr2.disposal_reason_id
        AND (p_date_from IS NULL OR dr2.disposal_date >= p_date_from)
        AND (p_date_to IS NULL OR dr2.disposal_date <= p_date_to)
        AND dr2.status = 'completed'
    GROUP BY dr.id, dr.name
    ORDER BY disposal_count DESC, total_weight_kg DESC;
END;
$$ LANGUAGE plpgsql;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION get_inventory_for_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION create_auto_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION get_disposal_summary_by_reason TO authenticated;

-- 5. Test the functions
SELECT 'Auto disposal functions created successfully!' as status;

-- Test getting inventory for disposal
SELECT 'Testing inventory for disposal (items older than 30 days):' as test;
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
