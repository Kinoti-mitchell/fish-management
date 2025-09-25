-- Modify Inventory System to Require Sorting
-- This script updates the inventory system to require sorting before adding fish to inventory

-- 1. Update the entry_type enum to include 'sorting'
DO $$ BEGIN
    ALTER TYPE entry_type ADD VALUE IF NOT EXISTS 'sorting';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create new function to add stock from sorting results (replaces direct processing)
CREATE OR REPLACE FUNCTION add_stock_from_sorting(p_sorting_batch_id UUID)
RETURNS TABLE(
    id UUID,
    size INTEGER,
    quantity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_sorting_batch RECORD;
    v_sorting_result RECORD;
    v_inventory_id UUID;
    v_inventory_size INTEGER;
    v_new_quantity INTEGER;
    v_created_at TIMESTAMP WITH TIME ZONE;
    v_updated_at TIMESTAMP WITH TIME ZONE;
    v_total_added INTEGER := 0;
BEGIN
    -- Get the sorting batch
    SELECT * INTO v_sorting_batch 
    FROM sorting_batches 
    WHERE id = p_sorting_batch_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sorting batch not found';
    END IF;
    
    -- Check if sorting batch is completed
    IF v_sorting_batch.status != 'completed' THEN
        RAISE EXCEPTION 'Sorting batch must be completed before adding to inventory. Current status: %', v_sorting_batch.status;
    END IF;
    
    -- Check if this sorting batch has already been added to inventory
    IF EXISTS (
        SELECT 1 FROM inventory_entries 
        WHERE reference_id = p_sorting_batch_id 
        AND entry_type = 'sorting'
    ) THEN
        RAISE EXCEPTION 'This sorting batch has already been added to inventory';
    END IF;
    
    -- Process each size class from sorting results
    FOR v_sorting_result IN 
        SELECT * FROM sorting_results 
        WHERE sorting_batch_id = p_sorting_batch_id
        AND total_pieces > 0
    LOOP
        v_inventory_size := v_sorting_result.size_class;
        
        -- Validate size class
        IF v_inventory_size < 0 OR v_inventory_size > 10 THEN
            CONTINUE; -- Skip invalid sizes
        END IF;
        
        -- Insert or update inventory
        INSERT INTO inventory (size, quantity)
        VALUES (v_inventory_size, v_sorting_result.total_pieces)
        ON CONFLICT (size) 
        DO UPDATE SET 
            quantity = inventory.quantity + v_sorting_result.total_pieces,
            updated_at = NOW()
        RETURNING inventory.id, inventory.size, inventory.quantity, inventory.created_at, inventory.updated_at
        INTO v_inventory_id, v_inventory_size, v_new_quantity, v_created_at, v_updated_at;
        
        -- Log the entry
        INSERT INTO inventory_entries (size, quantity_change, entry_type, reference_id, notes)
        VALUES (v_inventory_size, v_sorting_result.total_pieces, 'sorting', p_sorting_batch_id, 
                'From sorting batch ' || v_sorting_batch.batch_number || ' - ' || v_sorting_batch.sorting_date::TEXT);
        
        v_total_added := v_total_added + v_sorting_result.total_pieces;
    END LOOP;
    
    -- Return the first updated inventory row (or create a summary)
    IF v_total_added > 0 THEN
        RETURN QUERY 
        SELECT v_inventory_id, v_inventory_size, v_new_quantity, v_created_at, v_updated_at;
    ELSE
        RAISE EXCEPTION 'No valid size classes found in sorting batch';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Deprecate the old function (rename it to indicate it's deprecated)
CREATE OR REPLACE FUNCTION add_stock_from_processing_deprecated(p_processing_record_id UUID)
RETURNS TABLE(
    id UUID,
    size INTEGER,
    quantity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RAISE EXCEPTION 'Direct processing to inventory is no longer allowed. Fish must be sorted first. Use add_stock_from_sorting() instead.';
END;
$$ LANGUAGE plpgsql;

-- 4. Create function to get sorting batches ready for inventory
CREATE OR REPLACE FUNCTION get_sorting_batches_for_inventory()
RETURNS TABLE(
    id UUID,
    batch_number VARCHAR(50),
    sorting_date TIMESTAMP WITH TIME ZONE,
    total_pieces INTEGER,
    total_weight_grams DECIMAL,
    processing_record_id UUID,
    already_added BOOLEAN
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        sb.id,
        sb.batch_number,
        sb.sorting_date,
        sb.total_pieces,
        sb.total_weight_grams,
        sb.processing_record_id,
        EXISTS(
            SELECT 1 FROM inventory_entries ie 
            WHERE ie.reference_id = sb.id 
            AND ie.entry_type = 'sorting'
        ) as already_added
    FROM sorting_batches sb
    WHERE sb.status = 'completed'
    AND sb.total_pieces > 0
    ORDER BY sb.sorting_date DESC;
END;
$$ LANGUAGE plpgsql;

-- 5. Create function to validate sorting batch before inventory
CREATE OR REPLACE FUNCTION validate_sorting_batch_for_inventory(p_sorting_batch_id UUID)
RETURNS TABLE(
    is_valid BOOLEAN,
    message TEXT,
    batch_info JSONB
) AS $$
DECLARE
    v_batch RECORD;
    v_results_count INTEGER;
    v_total_pieces INTEGER;
BEGIN
    -- Get batch details
    SELECT * INTO v_batch FROM sorting_batches WHERE id = p_sorting_batch_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Sorting batch not found', '{}'::JSONB;
        RETURN;
    END IF;
    
    -- Check if batch is completed
    IF v_batch.status != 'completed' THEN
        RETURN QUERY SELECT FALSE, 'Sorting batch must be completed. Current status: ' || v_batch.status, 
                    jsonb_build_object('status', v_batch.status, 'batch_number', v_batch.batch_number);
        RETURN;
    END IF;
    
    -- Check if already added to inventory
    IF EXISTS (
        SELECT 1 FROM inventory_entries 
        WHERE reference_id = p_sorting_batch_id 
        AND entry_type = 'sorting'
    ) THEN
        RETURN QUERY SELECT FALSE, 'Sorting batch already added to inventory', 
                    jsonb_build_object('batch_number', v_batch.batch_number);
        RETURN;
    END IF;
    
    -- Check if has sorting results
    SELECT COUNT(*), COALESCE(SUM(total_pieces), 0) 
    INTO v_results_count, v_total_pieces
    FROM sorting_results 
    WHERE sorting_batch_id = p_sorting_batch_id;
    
    IF v_results_count = 0 THEN
        RETURN QUERY SELECT FALSE, 'No sorting results found for this batch', 
                    jsonb_build_object('batch_number', v_batch.batch_number);
        RETURN;
    END IF;
    
    IF v_total_pieces = 0 THEN
        RETURN QUERY SELECT FALSE, 'No fish pieces found in sorting results', 
                    jsonb_build_object('batch_number', v_batch.batch_number, 'results_count', v_results_count);
        RETURN;
    END IF;
    
    -- All validations passed
    RETURN QUERY SELECT TRUE, 'Sorting batch is valid for inventory', 
                jsonb_build_object(
                    'batch_number', v_batch.batch_number,
                    'total_pieces', v_total_pieces,
                    'total_weight', v_batch.total_weight_grams,
                    'results_count', v_results_count
                );
END;
$$ LANGUAGE plpgsql;

-- 6. Update the inventory summary function to show sorting data
CREATE OR REPLACE FUNCTION get_inventory_summary_with_sorting()
RETURNS TABLE(
    size INTEGER,
    current_stock INTEGER,
    total_added_from_sorting INTEGER,
    total_dispatched INTEGER,
    last_sorting_date TIMESTAMP WITH TIME ZONE,
    last_dispatch_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        i.size,
        i.quantity as current_stock,
        COALESCE(sorting_adds.total_added, 0) as total_added_from_sorting,
        COALESCE(dispatch_removes.total_dispatched, 0) as total_dispatched,
        sorting_adds.last_sorting_date,
        dispatch_removes.last_dispatch_date
    FROM inventory i
    LEFT JOIN (
        SELECT 
            size,
            SUM(quantity_change) as total_added,
            MAX(created_at) as last_sorting_date
        FROM inventory_entries 
        WHERE entry_type = 'sorting' AND quantity_change > 0
        GROUP BY size
    ) sorting_adds ON i.size = sorting_adds.size
    LEFT JOIN (
        SELECT 
            size,
            ABS(SUM(quantity_change)) as total_dispatched,
            MAX(created_at) as last_dispatch_date
        FROM inventory_entries 
        WHERE entry_type = 'order_dispatch' AND quantity_change < 0
        GROUP BY size
    ) dispatch_removes ON i.size = dispatch_removes.size
    ORDER BY i.size;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to get processing records that need sorting
CREATE OR REPLACE FUNCTION get_processing_records_needing_sorting()
RETURNS TABLE(
    id UUID,
    processing_date DATE,
    post_processing_weight DECIMAL,
    ready_for_dispatch_count INTEGER,
    already_sorted BOOLEAN,
    sorting_batch_id UUID
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        pr.id,
        pr.processing_date,
        pr.post_processing_weight,
        pr.ready_for_dispatch_count,
        EXISTS(
            SELECT 1 FROM sorting_batches sb 
            WHERE sb.processing_record_id = pr.id 
            AND sb.status = 'completed'
        ) as already_sorted,
        (
            SELECT sb.id FROM sorting_batches sb 
            WHERE sb.processing_record_id = pr.id 
            AND sb.status = 'completed'
            LIMIT 1
        ) as sorting_batch_id
    FROM processing_records pr
    WHERE pr.ready_for_dispatch_count > 0
    AND pr.post_processing_weight > 0
    ORDER BY pr.processing_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION add_stock_from_sorting(UUID) IS 'Adds fish to inventory from completed sorting batches. Replaces direct processing-to-inventory flow.';
COMMENT ON FUNCTION get_sorting_batches_for_inventory() IS 'Returns completed sorting batches that are ready to be added to inventory';
COMMENT ON FUNCTION validate_sorting_batch_for_inventory(UUID) IS 'Validates that a sorting batch can be added to inventory';
COMMENT ON FUNCTION get_inventory_summary_with_sorting() IS 'Returns inventory summary including sorting data';
COMMENT ON FUNCTION get_processing_records_needing_sorting() IS 'Returns processing records that need to be sorted before inventory';
