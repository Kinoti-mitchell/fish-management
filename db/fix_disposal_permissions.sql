-- Fix disposal module permissions and RLS policies
-- This script fixes the permission issues with the disposal tables

-- 1. Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view disposal reasons" ON disposal_reasons;
DROP POLICY IF EXISTS "Users can view disposal records" ON disposal_records;
DROP POLICY IF EXISTS "Users can view disposal items" ON disposal_items;
DROP POLICY IF EXISTS "Users can view disposal audit log" ON disposal_audit_log;
DROP POLICY IF EXISTS "Users can create disposal records" ON disposal_records;
DROP POLICY IF EXISTS "Users can update disposal records" ON disposal_records;
DROP POLICY IF EXISTS "Users can create disposal items" ON disposal_items;
DROP POLICY IF EXISTS "Users can create disposal audit log" ON disposal_audit_log;

-- 2. Grant table permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_reasons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_audit_log TO authenticated;

-- 3. Grant sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 4. Create more permissive RLS policies
CREATE POLICY "Allow all operations on disposal_reasons" ON disposal_reasons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on disposal_records" ON disposal_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on disposal_items" ON disposal_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on disposal_audit_log" ON disposal_audit_log FOR ALL USING (true) WITH CHECK (true);

-- 5. Ensure functions exist and have proper permissions
DO $$
BEGIN
    -- Check if functions exist and create them if they don't
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_disposal_number') THEN
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
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_disposal_summary') THEN
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
    END IF;
END $$;

-- 6. Grant function permissions
GRANT EXECUTE ON FUNCTION generate_disposal_number TO authenticated;
GRANT EXECUTE ON FUNCTION get_disposal_summary TO authenticated;

-- 7. Grant function permissions for other disposal functions if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_disposal_from_inventory') THEN
        GRANT EXECUTE ON FUNCTION create_disposal_from_inventory TO authenticated;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_item_to_disposal') THEN
        GRANT EXECUTE ON FUNCTION add_item_to_disposal TO authenticated;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'approve_disposal') THEN
        GRANT EXECUTE ON FUNCTION approve_disposal TO authenticated;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'complete_disposal') THEN
        GRANT EXECUTE ON FUNCTION complete_disposal TO authenticated;
    END IF;
END $$;

-- 8. Insert default disposal reasons if they don't exist
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

SELECT 'Disposal permissions fixed successfully!' as status;

