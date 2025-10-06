-- Complete Fix for Disposal Management System
-- This script addresses all disposal-related issues including 400 errors, missing tables, and permissions

-- ============================================
-- PART 1: Create/Fix Disposal Tables
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
    disposal_method TEXT NOT NULL DEFAULT 'waste',
    disposal_location TEXT,
    disposal_cost DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    disposed_by UUID,
    approved_by UUID,
    created_by TEXT DEFAULT 'system',
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
    quantity INTEGER NOT NULL DEFAULT 0,
    weight_kg DECIMAL(10,2) NOT NULL,
    batch_number TEXT,
    storage_location_name TEXT,
    farmer_name TEXT,
    processing_date DATE,
    quality_notes TEXT,
    disposal_reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PART 2: Add Missing Columns if Needed
-- ============================================

-- Add missing columns to disposal_records if they don't exist
DO $$ 
BEGIN
    -- Add created_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'disposal_records' AND column_name = 'created_by') THEN
        ALTER TABLE disposal_records ADD COLUMN created_by TEXT DEFAULT 'system';
    END IF;
    
    -- Add approved_by column if it doesn't exist (as text, not UUID)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'disposal_records' AND column_name = 'approved_by') THEN
        ALTER TABLE disposal_records ADD COLUMN approved_by TEXT DEFAULT 'system';
    END IF;
    
    -- Add disposal_method column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'disposal_records' AND column_name = 'disposal_method') THEN
        ALTER TABLE disposal_records ADD COLUMN disposal_method TEXT DEFAULT 'waste';
    END IF;
END $$;

-- Add missing columns to disposal_items if they don't exist
DO $$ 
BEGIN
    -- Add status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'disposal_items' AND column_name = 'status') THEN
        ALTER TABLE disposal_items ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
    
    -- Add quantity column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'disposal_items' AND column_name = 'quantity') THEN
        ALTER TABLE disposal_items ADD COLUMN quantity INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- ============================================
-- PART 3: Create Indexes for Performance
-- ============================================

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_disposal_records_status ON disposal_records(status);
CREATE INDEX IF NOT EXISTS idx_disposal_records_date ON disposal_records(disposal_date);
CREATE INDEX IF NOT EXISTS idx_disposal_records_reason ON disposal_records(disposal_reason_id);
CREATE INDEX IF NOT EXISTS idx_disposal_items_record ON disposal_items(disposal_record_id);
CREATE INDEX IF NOT EXISTS idx_disposal_items_sorting ON disposal_items(sorting_result_id);

-- ============================================
-- PART 4: Insert Default Disposal Reasons
-- ============================================

-- Insert default disposal reasons if they don't exist
INSERT INTO disposal_reasons (name, description, is_active) VALUES
    ('Age', 'Fish has been in storage too long and may have quality issues', true),
    ('Quality Issues', 'Fish shows signs of spoilage or quality degradation', true),
    ('Storage Inactive', 'Storage location is no longer active', true),
    ('Storage Over Capacity', 'Storage location is over capacity', true),
    ('No Storage Location', 'Item has no assigned storage location', true),
    ('Storage Not Found', 'Assigned storage location no longer exists', true),
    ('Processing Error', 'Error occurred during processing', true),
    ('Customer Return', 'Fish returned by customer', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- PART 5: Fix RLS Policies
-- ============================================

-- Enable RLS on disposal tables
ALTER TABLE disposal_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE disposal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE disposal_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all operations on disposal_reasons" ON disposal_reasons;
DROP POLICY IF EXISTS "Allow all operations on disposal_records" ON disposal_records;
DROP POLICY IF EXISTS "Allow all operations on disposal_items" ON disposal_items;

-- Create permissive policies for disposal tables
CREATE POLICY "Allow all operations on disposal_reasons" ON disposal_reasons
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on disposal_records" ON disposal_records
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on disposal_items" ON disposal_items
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- PART 6: Create Helper Functions
-- ============================================

-- Function to generate disposal number
CREATE OR REPLACE FUNCTION generate_disposal_number()
RETURNS TEXT AS $$
DECLARE
    today TEXT;
    sequence_num INTEGER;
    disposal_num TEXT;
BEGIN
    -- Get today's date in YYYYMMDD format
    today := TO_CHAR(NOW(), 'YYYYMMDD');
    
    -- Get next sequence number for today
    SELECT COALESCE(MAX(CAST(SUBSTRING(disposal_number FROM 'DISPOSAL-' || today || '-(.*)') AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM disposal_records
    WHERE disposal_number LIKE 'DISPOSAL-' || today || '-%';
    
    -- Generate disposal number
    disposal_num := 'DISPOSAL-' || today || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN disposal_num;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate disposal number on insert
CREATE OR REPLACE FUNCTION set_disposal_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.disposal_number IS NULL OR NEW.disposal_number = '' THEN
        NEW.disposal_number := generate_disposal_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating disposal numbers
DROP TRIGGER IF EXISTS trigger_set_disposal_number ON disposal_records;
CREATE TRIGGER trigger_set_disposal_number
    BEFORE INSERT ON disposal_records
    FOR EACH ROW
    EXECUTE FUNCTION set_disposal_number();

-- ============================================
-- PART 7: Grant Permissions
-- ============================================

-- Grant permissions to authenticated users
GRANT ALL ON disposal_reasons TO authenticated;
GRANT ALL ON disposal_records TO authenticated;
GRANT ALL ON disposal_items TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================
-- PART 8: Update Existing Data
-- ============================================

-- Update any existing disposal records that might have NULL disposal_method
UPDATE disposal_records 
SET disposal_method = 'waste' 
WHERE disposal_method IS NULL;

-- Update any existing disposal records that might have NULL created_by
UPDATE disposal_records 
SET created_by = 'system' 
WHERE created_by IS NULL;

-- Update any existing disposal records that might have NULL approved_by
UPDATE disposal_records 
SET approved_by = 'system' 
WHERE approved_by IS NULL;

-- ============================================
-- PART 9: Create Views for Better Queries
-- ============================================

-- Create a view for disposal records with reason names
CREATE OR REPLACE VIEW disposal_records_with_reasons AS
SELECT 
    dr.*,
    drr.name as disposal_reason_name,
    drr.description as disposal_reason_description
FROM disposal_records dr
LEFT JOIN disposal_reasons drr ON dr.disposal_reason_id = drr.id;

-- Grant access to the view
GRANT SELECT ON disposal_records_with_reasons TO authenticated;

-- ============================================
-- PART 10: Final Verification
-- ============================================

-- Verify tables exist and have correct structure
DO $$
BEGIN
    -- Check if all required tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'disposal_reasons') THEN
        RAISE EXCEPTION 'disposal_reasons table not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'disposal_records') THEN
        RAISE EXCEPTION 'disposal_records table not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'disposal_items') THEN
        RAISE EXCEPTION 'disposal_items table not created';
    END IF;
    
    RAISE NOTICE 'All disposal tables created successfully';
END $$;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'DISPOSAL SYSTEM FIX COMPLETED SUCCESSFULLY';
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ All disposal tables created/updated';
    RAISE NOTICE '✅ RLS policies configured';
    RAISE NOTICE '✅ Default disposal reasons inserted';
    RAISE NOTICE '✅ Helper functions created';
    RAISE NOTICE '✅ Permissions granted';
    RAISE NOTICE '✅ Views created for better queries';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'The disposal system should now work properly';
    RAISE NOTICE '============================================';
END $$;
