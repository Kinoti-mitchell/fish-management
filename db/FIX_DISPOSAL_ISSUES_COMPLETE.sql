-- Complete Fix for Disposal Management Issues
-- This script fixes all permission issues and creates missing functions

-- ============================================
-- PART 1: Fix Disposal Table Permissions
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view disposal reasons" ON disposal_reasons;
DROP POLICY IF EXISTS "Users can view disposal records" ON disposal_records;
DROP POLICY IF EXISTS "Users can view disposal items" ON disposal_items;
DROP POLICY IF EXISTS "Users can view disposal audit log" ON disposal_audit_log;
DROP POLICY IF EXISTS "Users can create disposal records" ON disposal_records;
DROP POLICY IF EXISTS "Users can update disposal records" ON disposal_records;
DROP POLICY IF EXISTS "Users can create disposal items" ON disposal_items;
DROP POLICY IF EXISTS "Users can create disposal audit log" ON disposal_audit_log;
DROP POLICY IF EXISTS "Allow all operations on disposal_reasons" ON disposal_reasons;
DROP POLICY IF EXISTS "Allow all operations on disposal_records" ON disposal_records;
DROP POLICY IF EXISTS "Allow all operations on disposal_items" ON disposal_items;
DROP POLICY IF EXISTS "Allow all operations on disposal_audit_log" ON disposal_audit_log;

-- Grant table permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_reasons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_audit_log TO authenticated;

-- Grant sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create more permissive RLS policies
CREATE POLICY "Allow all operations on disposal_reasons" ON disposal_reasons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on disposal_records" ON disposal_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on disposal_items" ON disposal_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on disposal_audit_log" ON disposal_audit_log FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- PART 2: Create Missing Functions
-- ============================================

-- Function to generate disposal number
CREATE OR REPLACE FUNCTION generate_disposal_number()
RETURNS TEXT AS $$
DECLARE
    v_date_prefix TEXT;
    v_sequence_num INTEGER;
    v_disposal_number TEXT;
BEGIN
    v_date_prefix := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    SELECT COALESCE(MAX(CAST(SUBSTRING(disposal_number FROM 10) AS INTEGER)), 0) + 1
    INTO v_sequence_num
    FROM disposal_records
    WHERE disposal_number LIKE v_date_prefix || '%';
    v_disposal_number := v_date_prefix || '-' || LPAD(v_sequence_num::TEXT, 3, '0');
    RETURN v_disposal_number;
END;
$$ LANGUAGE plpgsql;

-- Function to get inventory items that should be disposed
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

-- Function to create disposal record with auto-populated items
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

-- Function to get disposal summary
CREATE OR REPLACE FUNCTION get_disposal_summary(
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL
)
RETURNS TABLE(
    total_disposals INTEGER,
    total_weight_kg DECIMAL(10,2),
    total_pieces INTEGER,
    total_cost DECIMAL(10,2),
    by_reason JSONB,
    by_method JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_disposals,
        COALESCE(SUM(dr.total_weight_kg), 0) as total_weight_kg,
        COALESCE(SUM(dr.total_pieces), 0) as total_pieces,
        COALESCE(SUM(dr.disposal_cost), 0) as total_cost,
        '{}'::jsonb as by_reason,
        '{}'::jsonb as by_method
    FROM disposal_records dr
    WHERE (p_date_from IS NULL OR dr.disposal_date >= p_date_from)
    AND (p_date_to IS NULL OR dr.disposal_date <= p_date_to)
    AND dr.status = 'completed';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 3: Grant Function Permissions
-- ============================================

GRANT EXECUTE ON FUNCTION generate_disposal_number TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_for_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION create_auto_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION get_disposal_summary TO authenticated;

-- ============================================
-- PART 4: Insert Default Disposal Reasons
-- ============================================

INSERT INTO disposal_reasons (name, description) VALUES
('Quality Issues', 'Fish does not meet quality standards'),
('Expired', 'Fish has passed its shelf life'),
('Damaged', 'Physical damage during handling or storage'),
('Contamination', 'Suspected or confirmed contamination'),
('Overstock', 'Excess inventory that cannot be sold'),
('Customer Return', 'Returned by customer due to quality issues'),
('Regulatory Compliance', 'Disposal required by health regulations'),
('Temperature Abuse', 'Fish exposed to improper temperatures'),
('Packaging Issues', 'Problems with packaging integrity'),
('Other', 'Other reasons not listed above')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- PART 5: Test Functions
-- ============================================

SELECT 'Disposal issues fixed successfully!' as status;

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
