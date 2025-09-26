-- Fix Processing and Sorting Table Alignment
-- This script ensures all database functions use the correct table structure
-- The system uses sorting_results as the primary inventory, not inventory_entries

-- Step 1: Fix the add_stock_from_sorting function to work with the current system
-- Drop the existing function
DROP FUNCTION IF EXISTS add_stock_from_sorting(UUID);

-- Create the corrected function that works with sorting_results as inventory
CREATE OR REPLACE FUNCTION add_stock_from_sorting(p_sorting_batch_id UUID)
RETURNS TABLE(
    id UUID,
    size INTEGER,
    quantity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_sorting_batch RECORD;
    v_sorting_result RECORD;
    v_total_added INTEGER := 0;
BEGIN
    -- Validate input parameter
    IF p_sorting_batch_id IS NULL THEN
        RAISE EXCEPTION 'Sorting batch ID cannot be null';
    END IF;
    
    -- Get the sorting batch with explicit table reference
    SELECT sb.* INTO v_sorting_batch 
    FROM sorting_batches sb
    WHERE sb.id = p_sorting_batch_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sorting batch not found: %', p_sorting_batch_id;
    END IF;
    
    -- Check if sorting batch is completed
    IF v_sorting_batch.status != 'completed' THEN
        RAISE EXCEPTION 'Sorting batch must be completed before adding to inventory. Current status: %', v_sorting_batch.status;
    END IF;
    
    -- In the current system, sorting_results ARE the inventory
    -- We just need to return them to confirm they're "added to inventory"
    -- The frontend already handles the inventory display from sorting_results
    
    -- Process each size class from sorting results
    FOR v_sorting_result IN 
        SELECT sr.* FROM sorting_results sr
        WHERE sr.sorting_batch_id = p_sorting_batch_id
        AND sr.total_pieces > 0
    LOOP
        -- Return the existing sorting results as "inventory items"
        RETURN QUERY SELECT 
            v_sorting_result.id,
            v_sorting_result.size_class,
            v_sorting_result.total_pieces,
            v_sorting_result.created_at,
            v_sorting_result.updated_at;
        
        v_total_added := v_total_added + 1;
    END LOOP;
    
    -- If no items were found, raise an exception
    IF v_total_added = 0 THEN
        RAISE EXCEPTION 'No valid sorting results found for batch: %', p_sorting_batch_id;
    END IF;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Ensure all RLS policies are correct for the main tables
-- Fix RLS for processing_records
ALTER TABLE processing_records DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated users to view processing records" ON processing_records;
DROP POLICY IF EXISTS "Allow all authenticated users to insert processing records" ON processing_records;
DROP POLICY IF EXISTS "Allow all authenticated users to update processing records" ON processing_records;
DROP POLICY IF EXISTS "Allow all authenticated users to delete processing records" ON processing_records;
ALTER TABLE processing_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to view processing records" ON processing_records
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to insert processing records" ON processing_records
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to update processing records" ON processing_records
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to delete processing records" ON processing_records
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Fix RLS for sorting_batches
ALTER TABLE sorting_batches DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated users to view sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Allow all authenticated users to insert sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Allow all authenticated users to update sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Allow all authenticated users to delete sorting batches" ON sorting_batches;
ALTER TABLE sorting_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to view sorting batches" ON sorting_batches
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to insert sorting batches" ON sorting_batches
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to update sorting batches" ON sorting_batches
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to delete sorting batches" ON sorting_batches
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Fix RLS for sorting_results
ALTER TABLE sorting_results DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated users to view sorting results" ON sorting_results;
DROP POLICY IF EXISTS "Allow all authenticated users to insert sorting results" ON sorting_results;
DROP POLICY IF EXISTS "Allow all authenticated users to update sorting results" ON sorting_results;
DROP POLICY IF EXISTS "Allow all authenticated users to delete sorting results" ON sorting_results;
ALTER TABLE sorting_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to view sorting results" ON sorting_results
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to insert sorting results" ON sorting_results
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to update sorting results" ON sorting_results
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to delete sorting results" ON sorting_results
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Fix RLS for storage_locations
ALTER TABLE storage_locations DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated users to view storage locations" ON storage_locations;
DROP POLICY IF EXISTS "Allow all authenticated users to insert storage locations" ON storage_locations;
DROP POLICY IF EXISTS "Allow all authenticated users to update storage locations" ON storage_locations;
DROP POLICY IF EXISTS "Allow all authenticated users to delete storage locations" ON storage_locations;
ALTER TABLE storage_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to view storage locations" ON storage_locations
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to insert storage locations" ON storage_locations
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to update storage locations" ON storage_locations
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to delete storage locations" ON storage_locations
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Step 3: Grant necessary permissions
GRANT EXECUTE ON FUNCTION add_stock_from_sorting TO authenticated;
GRANT EXECUTE ON FUNCTION add_stock_from_sorting TO anon;

-- Step 4: Create a function to check data integrity
CREATE OR REPLACE FUNCTION check_processing_sorting_data_integrity()
RETURNS TABLE(
    table_name TEXT,
    record_count BIGINT,
    has_data BOOLEAN,
    status TEXT
) AS $$
BEGIN
    -- Check processing_records
    RETURN QUERY
    SELECT 
        'processing_records'::TEXT,
        COUNT(*)::BIGINT,
        (COUNT(*) > 0)::BOOLEAN,
        CASE 
            WHEN COUNT(*) = 0 THEN 'No processing records found'
            ELSE 'Processing records available'
        END::TEXT
    FROM processing_records;
    
    -- Check sorting_batches
    RETURN QUERY
    SELECT 
        'sorting_batches'::TEXT,
        COUNT(*)::BIGINT,
        (COUNT(*) > 0)::BOOLEAN,
        CASE 
            WHEN COUNT(*) = 0 THEN 'No sorting batches found'
            ELSE 'Sorting batches available'
        END::TEXT
    FROM sorting_batches;
    
    -- Check sorting_results
    RETURN QUERY
    SELECT 
        'sorting_results'::TEXT,
        COUNT(*)::BIGINT,
        (COUNT(*) > 0)::BOOLEAN,
        CASE 
            WHEN COUNT(*) = 0 THEN 'No sorting results found - this is your inventory!'
            ELSE 'Sorting results available - this is your inventory'
        END::TEXT
    FROM sorting_results;
    
    -- Check storage_locations
    RETURN QUERY
    SELECT 
        'storage_locations'::TEXT,
        COUNT(*)::BIGINT,
        (COUNT(*) > 0)::BOOLEAN,
        CASE 
            WHEN COUNT(*) = 0 THEN 'No storage locations found'
            ELSE 'Storage locations available'
        END::TEXT
    FROM storage_locations;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create a function to get current inventory from sorting_results
CREATE OR REPLACE FUNCTION get_current_inventory_from_sorting_results()
RETURNS TABLE(
    storage_location_id UUID,
    storage_location_name TEXT,
    size_class INTEGER,
    total_pieces BIGINT,
    total_weight_kg DECIMAL,
    batch_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sr.storage_location_id,
        sl.name as storage_location_name,
        sr.size_class,
        SUM(sr.total_pieces)::BIGINT as total_pieces,
        ROUND(SUM(sr.total_weight_grams) / 1000.0, 2) as total_weight_kg,
        COUNT(DISTINCT sr.sorting_batch_id)::BIGINT as batch_count
    FROM sorting_results sr
    LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
    LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    WHERE sb.status = 'completed'
    AND sr.total_pieces > 0
    GROUP BY sr.storage_location_id, sl.name, sr.size_class
    ORDER BY sl.name, sr.size_class;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for the new functions
GRANT EXECUTE ON FUNCTION check_processing_sorting_data_integrity TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_inventory_from_sorting_results TO authenticated;

-- Step 6: Run the data integrity check
SELECT 'Running data integrity check...' as status;
SELECT * FROM check_processing_sorting_data_integrity();

-- Step 7: Show current inventory if any exists
SELECT 'Current inventory from sorting_results:' as status;
SELECT * FROM get_current_inventory_from_sorting_results();

-- Step 8: Final status
SELECT 'Processing and sorting table alignment completed!' as status;
