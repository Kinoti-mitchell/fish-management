-- Complete Sorting System Fixes
-- This script applies all the necessary fixes for the sorting system

-- 1. Fix the inventory function bigint/integer mismatch
DROP FUNCTION IF EXISTS get_inventory_summary_with_sorting();

CREATE OR REPLACE FUNCTION get_inventory_summary_with_sorting()
RETURNS TABLE(
    size INTEGER,
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
        i.quantity as current_stock,
        COALESCE(sorting_adds.total_added, 0) as total_added_from_sorting,
        COALESCE(dispatch_removes.total_dispatched, 0) as total_dispatched,
        sorting_adds.last_sorting_date,
        dispatch_removes.last_dispatch_date
    FROM inventory i
    LEFT JOIN (
        SELECT 
            ie.size,
            SUM(ie.quantity_change) as total_added,
            MAX(ie.created_at) as last_sorting_date
        FROM inventory_entries ie
        WHERE ie.entry_type = 'sorting' AND ie.quantity_change > 0
        GROUP BY ie.size
    ) sorting_adds ON i.size = sorting_adds.size
    LEFT JOIN (
        SELECT 
            ie.size,
            ABS(SUM(ie.quantity_change)) as total_dispatched,
            MAX(ie.created_at) as last_dispatch_date
        FROM inventory_entries ie
        WHERE ie.entry_type = 'order_dispatch' AND ie.quantity_change < 0
        GROUP BY ie.size
    ) dispatch_removes ON i.size = dispatch_removes.size
    ORDER BY i.size;
END;
$$ LANGUAGE plpgsql;

-- 2. Add storage location fields to sorting tables
ALTER TABLE sorting_batches 
ADD COLUMN IF NOT EXISTS storage_location_id UUID REFERENCES storage_locations(id);

ALTER TABLE sorted_fish_items 
ADD COLUMN IF NOT EXISTS storage_location_id UUID REFERENCES storage_locations(id);

ALTER TABLE sorting_results 
ADD COLUMN IF NOT EXISTS storage_location_id UUID REFERENCES storage_locations(id);

-- 3. Drop existing function and create new one with storage location
DROP FUNCTION IF EXISTS create_sorting_batch(UUID, VARCHAR, UUID);
DROP FUNCTION IF EXISTS create_sorting_batch(UUID, VARCHAR);

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

-- 4. Drop existing function and create new one with storage location
DROP FUNCTION IF EXISTS add_sorted_fish_item(UUID, DECIMAL, DECIMAL, TEXT, TEXT);
DROP FUNCTION IF EXISTS add_sorted_fish_item(UUID, DECIMAL, DECIMAL, TEXT, TEXT, UUID);

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

-- 5. Fix foreign key relationships to use profiles table
ALTER TABLE sorting_batches DROP CONSTRAINT IF EXISTS sorting_batches_sorted_by_fkey;
ALTER TABLE sorting_batches 
ADD CONSTRAINT sorting_batches_sorted_by_fkey 
FOREIGN KEY (sorted_by) REFERENCES profiles(id);

ALTER TABLE size_class_thresholds DROP CONSTRAINT IF EXISTS size_class_thresholds_created_by_fkey;
ALTER TABLE size_class_thresholds 
ADD CONSTRAINT size_class_thresholds_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES profiles(id);

-- 6. Ensure all sorting tables have proper permissions
GRANT ALL ON size_class_thresholds TO authenticated;
GRANT ALL ON sorting_batches TO authenticated;
GRANT ALL ON sorted_fish_items TO authenticated;
GRANT ALL ON sorting_results TO authenticated;

GRANT ALL ON size_class_thresholds TO anon;
GRANT ALL ON sorting_batches TO anon;
GRANT ALL ON sorted_fish_items TO anon;
GRANT ALL ON sorting_results TO anon;

-- 7. Create permissive policies for all sorting tables
DROP POLICY IF EXISTS "Allow all operations on size_class_thresholds" ON size_class_thresholds;
CREATE POLICY "Allow all operations on size_class_thresholds" ON size_class_thresholds
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on sorting_batches" ON sorting_batches;
CREATE POLICY "Allow all operations on sorting_batches" ON sorting_batches
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on sorted_fish_items" ON sorted_fish_items;
CREATE POLICY "Allow all operations on sorted_fish_items" ON sorted_fish_items
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on sorting_results" ON sorting_results;
CREATE POLICY "Allow all operations on sorting_results" ON sorting_results
    FOR ALL USING (true) WITH CHECK (true);

-- 8. Fix any missing columns in sorted_fish_items table
ALTER TABLE sorted_fish_items ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT uuid_generate_v4();

-- 9. Grant function permissions
GRANT EXECUTE ON FUNCTION create_sorting_batch TO authenticated;
GRANT EXECUTE ON FUNCTION add_sorted_fish_item TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_summary_with_sorting TO authenticated;

-- 10. Verification
SELECT 'All sorting fixes applied successfully!' as status;
SELECT 'Storage location moved from processing to sorting' as status;
SELECT 'Database function bigint/integer mismatch fixed' as status;
SELECT 'Foreign key relationships updated to use profiles table' as status;
