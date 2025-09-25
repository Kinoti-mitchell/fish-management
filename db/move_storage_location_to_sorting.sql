-- Move storage location from processing to sorting
-- This reorganizes the workflow: Processing → Sorting (with storage location) → Inventory

-- 1. Add storage_location_id to sorting_batches table
ALTER TABLE sorting_batches 
ADD COLUMN IF NOT EXISTS storage_location_id UUID REFERENCES storage_locations(id);

-- 2. Add storage_location_id to sorted_fish_items table (for individual fish items)
ALTER TABLE sorted_fish_items 
ADD COLUMN IF NOT EXISTS storage_location_id UUID REFERENCES storage_locations(id);

-- 3. Add storage_location_id to sorting_results table (for aggregated results)
ALTER TABLE sorting_results 
ADD COLUMN IF NOT EXISTS storage_location_id UUID REFERENCES storage_locations(id);

-- 4. Update the create_sorting_batch function to include storage location
CREATE OR REPLACE FUNCTION create_sorting_batch(
    p_processing_record_id UUID,
    p_batch_number VARCHAR(50),
    p_sorted_by UUID DEFAULT NULL,
    p_storage_location_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_batch_id UUID;
    v_processing_record RECORD;
BEGIN
    -- Get processing record details
    SELECT * INTO v_processing_record 
    FROM processing_records 
    WHERE id = p_processing_record_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Processing record not found: %', p_processing_record_id;
    END IF;
    
    -- Check if processing record is already sorted
    IF EXISTS (
        SELECT 1 FROM sorting_batches 
        WHERE processing_record_id = p_processing_record_id 
        AND status = 'completed'
    ) THEN
        RAISE EXCEPTION 'Processing record already sorted: %', p_processing_record_id;
    END IF;
    
    -- Create sorting batch with storage location
    INSERT INTO sorting_batches (
        processing_record_id,
        batch_number,
        total_weight_grams,
        total_pieces,
        sorted_by,
        storage_location_id,
        status
    ) VALUES (
        p_processing_record_id,
        p_batch_number,
        v_processing_record.post_processing_weight * 1000, -- Convert kg to grams
        v_processing_record.ready_for_dispatch_count,
        p_sorted_by,
        p_storage_location_id,
        'pending'
    ) RETURNING id INTO v_batch_id;
    
    RETURN v_batch_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Update the add_sorted_fish_item function to include storage location
CREATE OR REPLACE FUNCTION add_sorted_fish_item(
    p_sorting_batch_id UUID,
    p_weight_grams DECIMAL,
    p_length_cm DECIMAL DEFAULT NULL,
    p_grade TEXT DEFAULT NULL,
    p_quality_notes TEXT DEFAULT NULL,
    p_storage_location_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_item_id UUID;
    v_size_class INTEGER;
    v_batch_storage_location UUID;
BEGIN
    -- Get the batch's storage location if not provided
    IF p_storage_location_id IS NULL THEN
        SELECT storage_location_id INTO v_batch_storage_location
        FROM sorting_batches 
        WHERE id = p_sorting_batch_id;
    ELSE
        v_batch_storage_location := p_storage_location_id;
    END IF;
    
    -- Get size class for the weight
    SELECT get_size_class_for_weight(p_weight_grams) INTO v_size_class;
    
    -- Insert the sorted fish item
    INSERT INTO sorted_fish_items (
        sorting_batch_id,
        size_class,
        weight_grams,
        length_cm,
        grade,
        quality_notes,
        storage_location_id
    ) VALUES (
        p_sorting_batch_id,
        v_size_class,
        p_weight_grams,
        p_length_cm,
        p_grade,
        p_quality_notes,
        v_batch_storage_location
    ) RETURNING id INTO v_item_id;
    
    -- Update sorting results
    INSERT INTO sorting_results (
        sorting_batch_id,
        size_class,
        total_pieces,
        total_weight_grams,
        average_weight_grams,
        grade_distribution,
        storage_location_id
    ) VALUES (
        p_sorting_batch_id,
        v_size_class,
        1,
        p_weight_grams,
        p_weight_grams,
        jsonb_build_object(p_grade, 1),
        v_batch_storage_location
    ) ON CONFLICT (sorting_batch_id, size_class) 
    DO UPDATE SET
        total_pieces = sorting_results.total_pieces + 1,
        total_weight_grams = sorting_results.total_weight_grams + p_weight_grams,
        average_weight_grams = (sorting_results.total_weight_grams + p_weight_grams) / (sorting_results.total_pieces + 1),
        grade_distribution = sorting_results.grade_distribution || jsonb_build_object(p_grade, COALESCE((sorting_results.grade_distribution->>p_grade)::integer, 0) + 1),
        updated_at = NOW();
    
    RETURN v_item_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Update inventory functions to consider storage location
CREATE OR REPLACE FUNCTION get_inventory_summary_with_sorting()
RETURNS TABLE(
    size INTEGER,
    storage_location_id UUID,
    storage_location_name TEXT,
    current_stock BIGINT,
    total_added_from_sorting BIGINT,
    total_dispatched BIGINT,
    last_sorting_date TIMESTAMP WITH TIME ZONE,
    last_dispatch_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        i.size,
        i.storage_location_id,
        sl.name as storage_location_name,
        i.quantity as current_stock,
        COALESCE(sorting_adds.total_added, 0) as total_added_from_sorting,
        COALESCE(dispatch_removes.total_dispatched, 0) as total_dispatched,
        sorting_adds.last_sorting_date,
        dispatch_removes.last_dispatch_date
    FROM inventory i
    LEFT JOIN storage_locations sl ON i.storage_location_id = sl.id
    LEFT JOIN (
        SELECT 
            ie.size,
            ie.storage_location_id,
            SUM(ie.quantity_change) as total_added,
            MAX(ie.created_at) as last_sorting_date
        FROM inventory_entries ie
        WHERE ie.entry_type = 'sorting' AND ie.quantity_change > 0
        GROUP BY ie.size, ie.storage_location_id
    ) sorting_adds ON i.size = sorting_adds.size AND i.storage_location_id = sorting_adds.storage_location_id
    LEFT JOIN (
        SELECT 
            ie.size,
            ie.storage_location_id,
            ABS(SUM(ie.quantity_change)) as total_dispatched,
            MAX(ie.created_at) as last_dispatch_date
        FROM inventory_entries ie
        WHERE ie.entry_type = 'order_dispatch' AND ie.quantity_change < 0
        GROUP BY ie.size, ie.storage_location_id
    ) dispatch_removes ON i.size = dispatch_removes.size AND i.storage_location_id = dispatch_removes.storage_location_id
    ORDER BY sl.name, i.size;
END;
$$ LANGUAGE plpgsql;

-- 7. Grant permissions
GRANT EXECUTE ON FUNCTION create_sorting_batch TO authenticated;
GRANT EXECUTE ON FUNCTION add_sorted_fish_item TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_summary_with_sorting TO authenticated;

-- 8. Verification
SELECT 'Storage location moved to sorting successfully' as status;
SELECT 'Functions updated to include storage location' as status;
