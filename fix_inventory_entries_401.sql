-- Fix 401 Unauthorized Error for inventory_entries
-- Run this in Supabase SQL Editor

-- 1. Disable Row Level Security for inventory_entries table
ALTER TABLE inventory_entries DISABLE ROW LEVEL SECURITY;

-- 2. Grant full permissions to authenticated and anon users
GRANT ALL ON inventory_entries TO authenticated;
GRANT ALL ON inventory_entries TO anon;

-- 3. Grant usage on the sequence if it exists
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- 4. Verify the table permissions
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasinserts,
    hasselects,
    hasupdates,
    hasdeletes
FROM pg_tables 
WHERE tablename = 'inventory_entries';

-- 5. Check if RLS is disabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'inventory_entries';

-- 6. Test query to verify access
SELECT 
    'inventory_entries' as table_name,
    COUNT(*) as record_count
FROM inventory_entries;


