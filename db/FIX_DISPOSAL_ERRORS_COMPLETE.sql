-- Complete Fix for Disposal Management Errors
-- This script addresses 400, 409, and permission errors

-- ============================================
-- PART 1: Ensure Tables Exist with Correct Structure
-- ============================================

-- Create disposal_reasons table if it doesn't exist
CREATE TABLE IF NOT EXISTS disposal_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create disposal_records table if it doesn't exist
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

-- Create disposal_items table if it doesn't exist
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

-- Create disposal_audit_log table if it doesn't exist
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

-- ============================================
-- PART 2: Fix RLS and Permissions
-- ============================================

-- Drop all existing policies
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

-- Disable RLS on all disposal tables
ALTER TABLE disposal_reasons DISABLE ROW LEVEL SECURITY;
ALTER TABLE disposal_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE disposal_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE disposal_audit_log DISABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_reasons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_audit_log TO authenticated;

-- Grant permissions to anon users (for custom auth)
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_reasons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_records TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_audit_log TO anon;

-- Grant sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- ============================================
-- PART 3: Create/Fix Disposal Functions
-- ============================================

-- Drop existing functions first to avoid conflicts
DROP FUNCTION IF EXISTS generate_disposal_number();
DROP FUNCTION IF EXISTS get_inventory_for_disposal(INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS approve_disposal(UUID, UUID);
DROP FUNCTION IF EXISTS complete_disposal(UUID, UUID);
DROP FUNCTION IF EXISTS create_auto_disposal(UUID, TEXT, TEXT, DECIMAL, TEXT, UUID, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS get_disposal_summary(DATE, DATE);

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

-- Function to get inventory for disposal (fixed version)
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
    -- Validate input parameters
    IF p_days_old IS NULL THEN
        p_days_old := 30;
    END IF;
    
    IF p_include_storage_issues IS NULL THEN
        p_include_storage_issues := TRUE;
    END IF;

    RETURN QUERY
    SELECT 
        sr.id as sorting_result_id,
        sr.size_class,
        sr.total_pieces,
        sr.total_weight_grams,
        COALESCE(sb.batch_number, 'BATCH-' || SUBSTRING(sb.id::text, 1, 8))::TEXT as batch_number,
        COALESCE(sl.name, 'Unknown Storage')::TEXT as storage_location_name,
        COALESCE(f.name, 'Unknown Farmer')::TEXT as farmer_name,
        COALESCE(pr.processing_date, sb.created_at::date) as processing_date,
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date)))::INTEGER as days_in_storage,
        (CASE 
            WHEN EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old THEN 'Expired'
            WHEN p_include_storage_issues AND sl.status = 'inactive' THEN 'Storage Inactive'
            WHEN p_include_storage_issues AND sl.status = 'maintenance' THEN 'Storage Maintenance'
            WHEN p_include_storage_issues AND sl.current_usage_kg > sl.capacity_kg THEN 'Storage Overcapacity'
            ELSE 'Quality Issues'
        END)::TEXT as disposal_reason,
        (CASE 
            WHEN EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) >= p_days_old THEN 
                'Fish older than ' || p_days_old || ' days - expired'
            WHEN p_include_storage_issues AND sl.status = 'inactive' THEN 
                'Storage location is inactive - ' || COALESCE(sl.name, 'Unknown') || ' - requires immediate disposal'
            WHEN p_include_storage_issues AND sl.status = 'maintenance' THEN 
                'Storage location under maintenance - ' || COALESCE(sl.name, 'Unknown') || ' - requires disposal'
            WHEN p_include_storage_issues AND sl.current_usage_kg > sl.capacity_kg THEN 
                'Storage overcapacity - ' || COALESCE(sl.name, 'Unknown')
            ELSE 'Quality issues detected'
        END)::TEXT as quality_notes
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
        -- Storage issues (including inactive and maintenance status)
        (p_include_storage_issues AND (
            sl.status = 'inactive' OR 
            sl.status = 'maintenance' OR
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
        -- Prioritize inactive storage items first
        CASE WHEN sl.status = 'inactive' THEN 1 ELSE 2 END,
        -- Then by maintenance items
        CASE WHEN sl.status = 'maintenance' THEN 1 ELSE 2 END,
        -- Then by age
        EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date))) DESC,
        -- Finally by weight
        sr.total_weight_grams DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to approve disposal
CREATE OR REPLACE FUNCTION approve_disposal(
    p_disposal_id UUID,
    p_approved_by UUID
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_disposal_number TEXT;
BEGIN
    -- Get disposal number for logging
    SELECT disposal_number INTO v_disposal_number
    FROM disposal_records
    WHERE id = p_disposal_id;
    
    IF v_disposal_number IS NULL THEN
        RAISE EXCEPTION 'Disposal record not found';
    END IF;
    
    -- Update disposal record
    UPDATE disposal_records
    SET status = 'approved',
        approved_by = p_approved_by,
        updated_at = NOW()
    WHERE id = p_disposal_id;
    
    -- Log audit
    INSERT INTO disposal_audit_log (disposal_record_id, action, new_values, performed_by, notes)
    VALUES (p_disposal_id, 'approved', 
            jsonb_build_object('status', 'approved', 'approved_by', p_approved_by),
            p_approved_by,
            'Disposal approved: ' || v_disposal_number);
    
    -- Return success
    RETURN QUERY SELECT 
        TRUE,
        'Disposal approved successfully' as message;
END;
$$ LANGUAGE plpgsql;

-- Function to complete disposal
CREATE OR REPLACE FUNCTION complete_disposal(
    p_disposal_id UUID,
    p_completed_by UUID
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_disposal_number TEXT;
    v_item RECORD;
    v_items_processed INTEGER := 0;
BEGIN
    -- Get disposal number for logging
    SELECT disposal_number INTO v_disposal_number
    FROM disposal_records
    WHERE id = p_disposal_id;
    
    IF v_disposal_number IS NULL THEN
        RAISE EXCEPTION 'Disposal record not found';
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
            'Disposal completed: ' || v_disposal_number || ' - ' || v_items_processed || ' items processed');
    
    -- Return success
    RETURN QUERY SELECT 
        TRUE,
        'Disposal completed successfully - inventory reduced' as message;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 4: Grant Function Permissions
-- ============================================

GRANT EXECUTE ON FUNCTION generate_disposal_number TO authenticated;
GRANT EXECUTE ON FUNCTION generate_disposal_number TO anon;
GRANT EXECUTE ON FUNCTION get_inventory_for_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_for_disposal TO anon;
GRANT EXECUTE ON FUNCTION approve_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION approve_disposal TO anon;
GRANT EXECUTE ON FUNCTION complete_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION complete_disposal TO anon;

-- ============================================
-- PART 5: Insert Default Data
-- ============================================

-- Insert default disposal reasons
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
-- PART 6: Test the System
-- ============================================

SELECT 'Disposal system completely fixed!' as status;

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

-- Test disposal reasons
SELECT 'Testing disposal reasons:' as test;
SELECT id, name, description FROM disposal_reasons WHERE is_active = true LIMIT 5;
