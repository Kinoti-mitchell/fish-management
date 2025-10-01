-- Fix RLS for sorting_results table (the actual inventory table)
-- Run this in Supabase SQL Editor

-- 1. Disable Row Level Security for sorting_results table
ALTER TABLE sorting_results DISABLE ROW LEVEL SECURITY;

-- 2. Drop any existing RLS policies on sorting_results
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON sorting_results;
DROP POLICY IF EXISTS "Enable read access for all users" ON sorting_results;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON sorting_results;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON sorting_results;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON sorting_results;

-- 3. Grant full permissions to all user types for sorting_results
GRANT ALL ON sorting_results TO authenticated;
GRANT ALL ON sorting_results TO anon;
GRANT ALL ON sorting_results TO service_role;

-- 4. Also fix sorting_batches table (related to inventory)
ALTER TABLE sorting_batches DISABLE ROW LEVEL SECURITY;
GRANT ALL ON sorting_batches TO authenticated;
GRANT ALL ON sorting_batches TO anon;
GRANT ALL ON sorting_batches TO service_role;

-- 5. Fix processing_records table (also related to inventory)
ALTER TABLE processing_records DISABLE ROW LEVEL SECURITY;
GRANT ALL ON processing_records TO authenticated;
GRANT ALL ON processing_records TO anon;
GRANT ALL ON processing_records TO service_role;

-- 6. Fix warehouse_entries table (also related to inventory)
ALTER TABLE warehouse_entries DISABLE ROW LEVEL SECURITY;
GRANT ALL ON warehouse_entries TO authenticated;
GRANT ALL ON warehouse_entries TO anon;
GRANT ALL ON warehouse_entries TO service_role;

-- 7. Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 8. Verify RLS is disabled for all inventory-related tables
SELECT 
    'sorting_results' as table_name,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'sorting_results'

UNION ALL

SELECT 
    'sorting_batches' as table_name,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'sorting_batches'

UNION ALL

SELECT 
    'processing_records' as table_name,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'processing_records'

UNION ALL

SELECT 
    'warehouse_entries' as table_name,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'warehouse_entries';

-- 9. Show success message
SELECT 'sorting_results (inventory) RLS fix completed successfully' as status;

