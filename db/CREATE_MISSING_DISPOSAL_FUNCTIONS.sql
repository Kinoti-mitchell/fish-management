-- Create the missing disposal functions that the component needs
-- Run this after fixing the get_inventory_for_disposal function

-- Function to create auto disposal
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
            jsonb_build_object('items_added', v_items_added, 'total_weight_kg', v_total_weight, 'total_pieces', v_total_pieces),
            p_disposed_by,
            'Auto-disposal created: ' || v_items_added || ' items, ' || v_total_weight || 'kg');
    
    -- Return result
    RETURN QUERY SELECT 
        v_disposal_id,
        v_disposal_number,
        v_items_added,
        v_total_weight,
        v_total_pieces,
        'Disposal created successfully with ' || v_items_added || ' items (' || v_total_weight || 'kg)' as message;
END;
$$ LANGUAGE plpgsql;

-- Function to approve disposal
CREATE OR REPLACE FUNCTION approve_disposal(
    p_disposal_id UUID,
    p_approved_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_disposal RECORD;
BEGIN
    -- Get disposal record
    SELECT * INTO v_disposal FROM disposal_records WHERE id = p_disposal_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Disposal record not found';
    END IF;
    
    IF v_disposal.status != 'pending' THEN
        RAISE EXCEPTION 'Disposal record is not in pending status';
    END IF;
    
    -- Update disposal record
    UPDATE disposal_records
    SET status = 'approved',
        approved_by = p_approved_by,
        updated_at = NOW()
    WHERE id = p_disposal_id;
    
    -- Log audit
    INSERT INTO disposal_audit_log (disposal_record_id, action, new_values, performed_by)
    VALUES (p_disposal_id, 'approved', 
            jsonb_build_object('status', 'approved', 'approved_by', p_approved_by),
            p_approved_by);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to complete disposal (reduce inventory)
CREATE OR REPLACE FUNCTION complete_disposal(
    p_disposal_id UUID,
    p_completed_by UUID
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_disposal RECORD;
    v_item RECORD;
    v_items_processed INTEGER := 0;
BEGIN
    -- Get disposal record
    SELECT * INTO v_disposal FROM disposal_records WHERE id = p_disposal_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Disposal record not found';
    END IF;
    
    IF v_disposal.status != 'approved' THEN
        RAISE EXCEPTION 'Disposal record must be approved before completion';
    END IF;
    
    -- Reduce inventory for each disposal item
    FOR v_item IN
        SELECT di.*, sr.id as sorting_result_id
        FROM disposal_items di
        LEFT JOIN sorting_results sr ON di.sorting_result_id = sr.id
        WHERE di.disposal_record_id = p_disposal_id
    LOOP
        -- Reduce inventory quantity
        UPDATE sorting_results
        SET total_pieces = GREATEST(0, total_pieces - v_item.quantity),
            total_weight_grams = GREATEST(0, total_weight_grams - (v_item.weight_kg * 1000))
        WHERE id = v_item.sorting_result_id;
        
        v_items_processed := v_items_processed + 1;
    END LOOP;
    
    -- Update disposal record status
    UPDATE disposal_records
    SET status = 'completed',
        updated_at = NOW()
    WHERE id = p_disposal_id;
    
    -- Log audit
    INSERT INTO disposal_audit_log (disposal_record_id, action, new_values, performed_by, notes)
    VALUES (p_disposal_id, 'completed', 
            jsonb_build_object('status', 'completed', 'items_processed', v_items_processed),
            p_completed_by,
            'Disposal completed: ' || v_items_processed || ' items processed');
    
    -- Return success
    RETURN QUERY SELECT 
        TRUE,
        'Disposal completed successfully - inventory has been reduced' as message;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to all functions
GRANT EXECUTE ON FUNCTION create_auto_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION create_auto_disposal TO anon;
GRANT EXECUTE ON FUNCTION approve_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION approve_disposal TO anon;
GRANT EXECUTE ON FUNCTION complete_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION complete_disposal TO anon;

SELECT 'All disposal functions created successfully!' as status;

