-- Fix Sorting RLS Policies and Missing Functions
-- This script addresses the 406 and 404 errors in the sorting system

-- Step 1: Fix RLS policies for sorting_batches table
-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Users can view sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Users can create sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Users can update their own sorting batches" ON sorting_batches;

-- Create more permissive policies for sorting_batches
CREATE POLICY "Allow all authenticated users to view sorting batches" ON sorting_batches
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated users to create sorting batches" ON sorting_batches
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated users to update sorting batches" ON sorting_batches
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Step 2: Create the missing create_sorting_batch_safe function
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
    -- Check if processing record exists
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

-- Step 3: Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_sorting_batch_safe TO authenticated;
GRANT EXECUTE ON FUNCTION create_sorting_batch_safe TO anon;

-- Step 4: Fix RLS for processing_records table if needed
DROP POLICY IF EXISTS "Users can view processing records" ON processing_records;
DROP POLICY IF EXISTS "Users can update processing records" ON processing_records;

CREATE POLICY "Allow all authenticated users to view processing records" ON processing_records
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated users to update processing records" ON processing_records
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Step 5: Create a simpler function for checking existing sorting batches
CREATE OR REPLACE FUNCTION check_existing_sorting_batch(p_processing_record_id UUID)
RETURNS TABLE(
    id UUID,
    batch_number VARCHAR(50),
    status sorting_status
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sb.id,
        sb.batch_number,
        sb.status
    FROM sorting_batches sb
    WHERE sb.processing_record_id = p_processing_record_id
    AND sb.status = 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for the check function
GRANT EXECUTE ON FUNCTION check_existing_sorting_batch TO authenticated;
GRANT EXECUTE ON FUNCTION check_existing_sorting_batch TO anon;

-- Step 6: Verify the functions exist
SELECT 
    'Functions created successfully:' as status,
    proname as function_name,
    prokind as function_type
FROM pg_proc 
WHERE proname IN ('create_sorting_batch_safe', 'check_existing_sorting_batch');

-- Step 7: Test the RLS policies
SELECT 
    'RLS policies status:' as status,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('sorting_batches', 'processing_records')
ORDER BY tablename, policyname;

-- Step 8: Show current sorting batches (if any)
SELECT 
    'Current sorting batches:' as status,
    COUNT(*) as total_batches,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_batches
FROM sorting_batches;
