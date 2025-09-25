-- Minimal fix for disposal functionality
-- This ensures the basic disposal system works

-- 1. Ensure disposal tables exist with proper structure
CREATE TABLE IF NOT EXISTS disposal_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disposal_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disposal_number TEXT NOT NULL UNIQUE,
    disposal_date DATE NOT NULL DEFAULT CURRENT_DATE,
    disposal_reason_id UUID REFERENCES disposal_reasons(id),
    total_weight_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_pieces INTEGER NOT NULL DEFAULT 0,
    disposal_method TEXT NOT NULL,
    disposal_location TEXT,
    disposal_cost DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    disposed_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS disposal_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disposal_record_id UUID REFERENCES disposal_records(id),
    action TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    performed_by UUID REFERENCES auth.users(id),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

-- 2. Insert default disposal reasons if they don't exist
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

-- 3. Disable RLS and grant permissions
ALTER TABLE disposal_reasons DISABLE ROW LEVEL SECURITY;
ALTER TABLE disposal_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE disposal_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE disposal_audit_log DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_reasons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_audit_log TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_reasons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_records TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_audit_log TO anon;

-- 4. Create the essential disposal functions
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
            WHEN p_include_storage_issues AND (sl.status != 'active' OR sl.status IS NULL) THEN 'Storage Malfunction'
            WHEN p_include_storage_issues AND sl.current_usage_kg > sl.capacity_kg THEN 'Storage Overcapacity'
            ELSE 'Quality Issues'
        END as disposal_reason,
        CASE 
            WHEN EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old THEN 
                'Item is ' || EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date)))::INTEGER || ' days old'
            WHEN p_include_storage_issues AND (sl.status != 'active' OR sl.status IS NULL) THEN 
                'Storage location is inactive or malfunctioning'
            WHEN p_include_storage_issues AND sl.current_usage_kg > sl.capacity_kg THEN 
                'Storage location is over capacity'
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
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old
        OR
        (p_include_storage_issues AND (
            sl.status != 'active' OR 
            sl.status IS NULL OR
            sl.current_usage_kg > sl.capacity_kg
        ))
    )
    ORDER BY days_in_storage DESC, sr.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 5. Grant function permissions
GRANT EXECUTE ON FUNCTION generate_disposal_number TO authenticated;
GRANT EXECUTE ON FUNCTION generate_disposal_number TO anon;
GRANT EXECUTE ON FUNCTION get_inventory_for_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_for_disposal TO anon;

SELECT 'Minimal disposal fix applied successfully!' as status;

