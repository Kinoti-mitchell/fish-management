-- Fish Disposal Management Module
-- Handles disposal of fish due to quality issues, expiration, or other reasons

-- 1. Create disposal reasons table
CREATE TABLE IF NOT EXISTS disposal_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create disposal records table
CREATE TABLE IF NOT EXISTS disposal_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disposal_number TEXT NOT NULL UNIQUE,
    disposal_date DATE NOT NULL DEFAULT CURRENT_DATE,
    disposal_reason_id UUID REFERENCES disposal_reasons(id),
    total_weight_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_pieces INTEGER NOT NULL DEFAULT 0,
    disposal_method TEXT NOT NULL, -- 'compost', 'waste', 'donation', 'return_to_farmer'
    disposal_location TEXT, -- Where the disposal took place
    disposal_cost DECIMAL(10,2) DEFAULT 0, -- Cost of disposal
    notes TEXT,
    disposed_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create disposal items table (individual fish items being disposed)
CREATE TABLE IF NOT EXISTS disposal_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disposal_record_id UUID REFERENCES disposal_records(id) ON DELETE CASCADE,
    sorting_result_id UUID REFERENCES sorting_results(id),
    size_class INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    weight_kg DECIMAL(10,2) NOT NULL,
    batch_number TEXT,
    storage_location_name TEXT,
    farmer_name TEXT,
    processing_date DATE,
    quality_notes TEXT,
    disposal_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create disposal audit log table
CREATE TABLE IF NOT EXISTS disposal_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disposal_record_id UUID REFERENCES disposal_records(id),
    action TEXT NOT NULL, -- 'created', 'updated', 'approved', 'completed', 'cancelled'
    old_values JSONB,
    new_values JSONB,
    performed_by UUID REFERENCES auth.users(id),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

-- 5. Insert default disposal reasons
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

-- 6. Create function to generate disposal number
CREATE OR REPLACE FUNCTION generate_disposal_number()
RETURNS TEXT AS $$
DECLARE
    v_date_prefix TEXT;
    v_sequence_num INTEGER;
    v_disposal_number TEXT;
BEGIN
    -- Get date prefix (YYYYMMDD)
    v_date_prefix := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    
    -- Get next sequence number for today
    SELECT COALESCE(MAX(CAST(SUBSTRING(disposal_number FROM 10) AS INTEGER)), 0) + 1
    INTO v_sequence_num
    FROM disposal_records
    WHERE disposal_number LIKE v_date_prefix || '%';
    
    -- Format disposal number
    v_disposal_number := v_date_prefix || '-' || LPAD(v_sequence_num::TEXT, 3, '0');
    
    RETURN v_disposal_number;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to create disposal record from inventory
CREATE OR REPLACE FUNCTION create_disposal_from_inventory(
    p_disposal_reason_id UUID,
    p_disposal_method TEXT,
    p_disposal_location TEXT DEFAULT NULL,
    p_disposal_cost DECIMAL(10,2) DEFAULT 0,
    p_notes TEXT DEFAULT NULL,
    p_disposed_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_disposal_id UUID;
    v_disposal_number TEXT;
BEGIN
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
        p_notes,
        p_disposed_by,
        'pending'
    ) RETURNING id INTO v_disposal_id;
    
    RETURN v_disposal_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to add items to disposal
CREATE OR REPLACE FUNCTION add_item_to_disposal(
    p_disposal_id UUID,
    p_sorting_result_id UUID,
    p_quantity INTEGER,
    p_quality_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_sorting_result RECORD;
    v_weight_kg DECIMAL(10,2);
BEGIN
    -- Get sorting result details
    SELECT sr.*, sb.batch_number, sl.name as storage_location_name,
           f.name as farmer_name, pr.processing_date
    INTO v_sorting_result
    FROM sorting_results sr
    JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
    JOIN processing_records pr ON sb.processing_record_id = pr.id
    JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
    JOIN farmers f ON we.farmer_id = f.id
    WHERE sr.id = p_sorting_result_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sorting result not found';
    END IF;
    
    -- Check if quantity is available
    IF p_quantity > v_sorting_result.total_pieces THEN
        RAISE EXCEPTION 'Insufficient quantity available for disposal';
    END IF;
    
    -- Calculate weight
    v_weight_kg := (p_quantity::DECIMAL / v_sorting_result.total_pieces::DECIMAL) * 
                   (v_sorting_result.total_weight_grams / 1000.0);
    
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
        quality_notes
    ) VALUES (
        p_disposal_id,
        p_sorting_result_id,
        v_sorting_result.size_class,
        p_quantity,
        v_weight_kg,
        v_sorting_result.batch_number,
        v_sorting_result.storage_location_name,
        v_sorting_result.farmer_name,
        v_sorting_result.processing_date,
        p_quality_notes
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to approve disposal
CREATE OR REPLACE FUNCTION approve_disposal(
    p_disposal_id UUID,
    p_approved_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_disposal RECORD;
    v_item RECORD;
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

-- 10. Create function to complete disposal (reduce inventory)
CREATE OR REPLACE FUNCTION complete_disposal(
    p_disposal_id UUID,
    p_completed_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_disposal RECORD;
    v_item RECORD;
    v_remaining_pieces INTEGER;
    v_remaining_weight DECIMAL(10,2);
BEGIN
    -- Get disposal record
    SELECT * INTO v_disposal FROM disposal_records WHERE id = p_disposal_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Disposal record not found';
    END IF;
    
    IF v_disposal.status != 'approved' THEN
        RAISE EXCEPTION 'Disposal record must be approved before completion';
    END IF;
    
    -- Process each disposal item
    FOR v_item IN
        SELECT * FROM disposal_items WHERE disposal_record_id = p_disposal_id
    LOOP
        -- Reduce inventory
        UPDATE sorting_results
        SET total_pieces = total_pieces - v_item.quantity,
            total_weight_grams = total_weight_grams - (v_item.weight_kg * 1000),
            updated_at = NOW()
        WHERE id = v_item.sorting_result_id;
        
        -- Check if sorting result is now empty
        SELECT total_pieces, total_weight_grams INTO v_remaining_pieces, v_remaining_weight
        FROM sorting_results WHERE id = v_item.sorting_result_id;
        
        -- If no pieces left, set to 0
        IF v_remaining_pieces <= 0 THEN
            UPDATE sorting_results
            SET total_pieces = 0,
                total_weight_grams = 0,
                updated_at = NOW()
            WHERE id = v_item.sorting_result_id;
        END IF;
    END LOOP;
    
    -- Update disposal record
    UPDATE disposal_records
    SET status = 'completed',
        updated_at = NOW()
    WHERE id = p_disposal_id;
    
    -- Log audit
    INSERT INTO disposal_audit_log (disposal_record_id, action, new_values, performed_by)
    VALUES (p_disposal_id, 'completed', 
            jsonb_build_object('status', 'completed'),
            p_completed_by);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 11. Create function to cancel disposal
CREATE OR REPLACE FUNCTION cancel_disposal(
    p_disposal_id UUID,
    p_cancelled_by UUID,
    p_cancellation_reason TEXT DEFAULT NULL
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
    
    IF v_disposal.status = 'completed' THEN
        RAISE EXCEPTION 'Cannot cancel a completed disposal record';
    END IF;
    
    IF v_disposal.status = 'cancelled' THEN
        RAISE EXCEPTION 'Disposal record is already cancelled';
    END IF;
    
    -- Update disposal record
    UPDATE disposal_records
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_disposal_id;
    
    -- Log audit
    INSERT INTO disposal_audit_log (disposal_record_id, action, new_values, performed_by, notes)
    VALUES (p_disposal_id, 'cancelled', 
            jsonb_build_object('status', 'cancelled', 'cancellation_reason', p_cancellation_reason),
            p_cancelled_by, p_cancellation_reason);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 12. Create function to get disposal summary
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
        jsonb_object_agg(dr2.name, dr2.count) as by_reason,
        jsonb_object_agg(dr3.method, dr3.count) as by_method
    FROM disposal_records dr
    LEFT JOIN (
        SELECT dr2.disposal_reason_id, dr2.name, COUNT(*) as count
        FROM disposal_records dr2
        JOIN disposal_reasons dr2 ON dr2.id = dr2.disposal_reason_id
        WHERE (p_date_from IS NULL OR dr2.disposal_date >= p_date_from)
        AND (p_date_to IS NULL OR dr2.disposal_date <= p_date_to)
        AND dr2.status = 'completed'
        GROUP BY dr2.disposal_reason_id, dr2.name
    ) dr2 ON dr.disposal_reason_id = dr2.disposal_reason_id
    LEFT JOIN (
        SELECT dr3.disposal_method as method, COUNT(*) as count
        FROM disposal_records dr3
        WHERE (p_date_from IS NULL OR dr3.disposal_date >= p_date_from)
        AND (p_date_to IS NULL OR dr3.disposal_date <= p_date_to)
        AND dr3.status = 'completed'
        GROUP BY dr3.disposal_method
    ) dr3 ON dr.disposal_method = dr3.method
    WHERE (p_date_from IS NULL OR dr.disposal_date >= p_date_from)
    AND (p_date_to IS NULL OR dr.disposal_date <= p_date_to)
    AND dr.status = 'completed';
END;
$$ LANGUAGE plpgsql;

-- 12. Enable Row Level Security
ALTER TABLE disposal_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE disposal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE disposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE disposal_audit_log ENABLE ROW LEVEL SECURITY;

-- 13. Create RLS policies
CREATE POLICY "Users can view disposal reasons" ON disposal_reasons FOR SELECT USING (true);
CREATE POLICY "Users can view disposal records" ON disposal_records FOR SELECT USING (true);
CREATE POLICY "Users can view disposal items" ON disposal_items FOR SELECT USING (true);
CREATE POLICY "Users can view disposal audit log" ON disposal_audit_log FOR SELECT USING (true);

CREATE POLICY "Users can create disposal records" ON disposal_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update disposal records" ON disposal_records FOR UPDATE USING (true);
CREATE POLICY "Users can create disposal items" ON disposal_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can create disposal audit log" ON disposal_audit_log FOR INSERT WITH CHECK (true);

-- 14. Grant permissions
GRANT EXECUTE ON FUNCTION generate_disposal_number TO authenticated;
GRANT EXECUTE ON FUNCTION create_disposal_from_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION add_item_to_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION approve_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION complete_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION get_disposal_summary TO authenticated;

SELECT 'Fish disposal management module created successfully!' as status;
