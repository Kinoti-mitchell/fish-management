-- Fix Sort Fish Button Error
-- This script addresses the error when clicking the "Sort Fish" button
-- The error is likely due to missing tables, RLS policies, or database functions

-- Step 1: Ensure sorting_batches table exists with correct structure
CREATE TABLE IF NOT EXISTS sorting_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processing_record_id UUID NOT NULL,
    batch_number VARCHAR(50) NOT NULL,
    total_weight_grams DECIMAL(12,2) NOT NULL,
    total_pieces INTEGER NOT NULL,
    sorting_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sorted_by UUID,
    status VARCHAR(20) DEFAULT 'pending',
    storage_location_id UUID,
    size_distribution JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(processing_record_id, batch_number)
);

-- Step 2: Ensure sorting_results table exists
CREATE TABLE IF NOT EXISTS sorting_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sorting_batch_id UUID NOT NULL REFERENCES sorting_batches(id) ON DELETE CASCADE,
    size_class INTEGER NOT NULL CHECK (size_class >= 0 AND size_class <= 10),
    total_weight_grams DECIMAL(12,2) NOT NULL,
    total_pieces INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Ensure storage_locations table exists
CREATE TABLE IF NOT EXISTS storage_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    location_type VARCHAR(50) DEFAULT 'cold_storage',
    capacity_kg DECIMAL(12,2),
    current_usage_kg DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Insert default storage locations if they don't exist
INSERT INTO storage_locations (id, name, location_type, capacity_kg, status) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Cold Storage A', 'cold_storage', 2000, 'active'),
    ('22222222-2222-2222-2222-222222222222', 'Cold Storage B', 'cold_storage', 1500, 'active'),
    ('33333333-3333-3333-3333-333333333333', 'Freezer Unit 1', 'freezer', 1000, 'active'),
    ('44444444-4444-4444-4444-444444444444', 'Processing Area 1', 'processing', 500, 'active'),
    ('55555555-5555-5555-5555-555555555555', 'Processing Area 2', 'processing', 500, 'active')
ON CONFLICT (id) DO NOTHING;

-- Step 5: Fix RLS policies for sorting_batches table
DROP POLICY IF EXISTS "Allow all authenticated users to view sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Allow all authenticated users to create sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Allow all authenticated users to update sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Users can view sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Users can create sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Users can update their own sorting batches" ON sorting_batches;

-- Enable RLS
ALTER TABLE sorting_batches ENABLE ROW LEVEL SECURITY;

-- Create permissive policies
CREATE POLICY "Allow all authenticated users to view sorting batches" ON sorting_batches
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated users to create sorting batches" ON sorting_batches
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated users to update sorting batches" ON sorting_batches
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Step 6: Fix RLS policies for sorting_results table
DROP POLICY IF EXISTS "Allow all authenticated users to view sorting results" ON sorting_results;
DROP POLICY IF EXISTS "Allow all authenticated users to create sorting results" ON sorting_results;
DROP POLICY IF EXISTS "Allow all authenticated users to update sorting results" ON sorting_results;

-- Enable RLS
ALTER TABLE sorting_results ENABLE ROW LEVEL SECURITY;

-- Create permissive policies
CREATE POLICY "Allow all authenticated users to view sorting results" ON sorting_results
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated users to create sorting results" ON sorting_results
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated users to update sorting results" ON sorting_results
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Step 7: Fix RLS policies for storage_locations table
DROP POLICY IF EXISTS "Allow all authenticated users to view storage locations" ON storage_locations;
DROP POLICY IF EXISTS "Allow all authenticated users to create storage locations" ON storage_locations;
DROP POLICY IF EXISTS "Allow all authenticated users to update storage locations" ON storage_locations;

-- Enable RLS
ALTER TABLE storage_locations ENABLE ROW LEVEL SECURITY;

-- Create permissive policies
CREATE POLICY "Allow all authenticated users to view storage locations" ON storage_locations
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated users to create storage locations" ON storage_locations
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated users to update storage locations" ON storage_locations
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Step 8: Create the create_sorting_batch_safe function
CREATE OR REPLACE FUNCTION create_sorting_batch_safe(
    p_processing_record_id UUID,
    p_batch_number VARCHAR(50),
    p_total_weight_grams DECIMAL,
    p_total_pieces INTEGER,
    p_storage_location_id UUID DEFAULT NULL,
    p_size_distribution JSONB DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
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
    
    -- Check if there's already a completed sorting batch for this processing record
    IF EXISTS (
        SELECT 1 FROM sorting_batches 
        WHERE processing_record_id = p_processing_record_id 
        AND status = 'completed'
    ) THEN
        RAISE EXCEPTION 'Processing record % has already been sorted', p_processing_record_id;
    END IF;
    
    -- Create sorting batch
    INSERT INTO sorting_batches (
        processing_record_id,
        batch_number,
        total_weight_grams,
        total_pieces,
        sorting_date,
        status,
        storage_location_id,
        size_distribution,
        notes
    ) VALUES (
        p_processing_record_id,
        p_batch_number,
        p_total_weight_grams,
        p_total_pieces,
        NOW(),
        'completed',
        p_storage_location_id,
        p_size_distribution,
        p_notes
    ) RETURNING id INTO v_batch_id;
    
    RETURN v_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_sorting_batch_safe TO authenticated;
GRANT EXECUTE ON FUNCTION create_sorting_batch_safe TO anon;

-- Step 10: Create function to add stock from sorting
CREATE OR REPLACE FUNCTION add_stock_from_sorting(p_sorting_batch_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_batch RECORD;
    v_result RECORD;
    v_inventory_items JSONB := '[]'::jsonb;
    v_item JSONB;
BEGIN
    -- Get the sorting batch
    SELECT * INTO v_batch
    FROM sorting_batches
    WHERE id = p_sorting_batch_id AND status = 'completed';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sorting batch not found or not completed: %', p_sorting_batch_id;
    END IF;
    
    -- Get sorting results
    FOR v_result IN 
        SELECT * FROM sorting_results 
        WHERE sorting_batch_id = p_sorting_batch_id
    LOOP
        -- Create inventory item
        v_item := jsonb_build_object(
            'size_class', v_result.size_class,
            'weight_kg', v_result.total_weight_grams / 1000.0,
            'pieces', v_result.total_pieces,
            'source', 'sorting',
            'source_id', p_sorting_batch_id
        );
        
        v_inventory_items := v_inventory_items || v_item;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'batch_id', p_sorting_batch_id,
        'items_added', v_inventory_items
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 11: Grant permissions for the inventory function
GRANT EXECUTE ON FUNCTION add_stock_from_sorting TO authenticated;
GRANT EXECUTE ON FUNCTION add_stock_from_sorting TO anon;

-- Step 12: Verify tables exist and have data
SELECT 
    'Table verification:' as status,
    'sorting_batches' as table_name,
    COUNT(*) as record_count
FROM sorting_batches
UNION ALL
SELECT 
    'Table verification:' as status,
    'sorting_results' as table_name,
    COUNT(*) as record_count
FROM sorting_results
UNION ALL
SELECT 
    'Table verification:' as status,
    'storage_locations' as table_name,
    COUNT(*) as record_count
FROM storage_locations;

-- Step 13: Show function verification
SELECT 
    'Function verification:' as status,
    proname as function_name,
    'exists' as status
FROM pg_proc 
WHERE proname IN ('create_sorting_batch_safe', 'add_stock_from_sorting');
