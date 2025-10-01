-- Complete Fix for inventory_entries 401 and RLS Issues
-- Run this in Supabase SQL Editor

-- 1. Completely disable Row Level Security for inventory_entries
ALTER TABLE inventory_entries DISABLE ROW LEVEL SECURITY;

-- 2. Drop any existing RLS policies (if they exist)
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON inventory_entries;
DROP POLICY IF EXISTS "Enable read access for all users" ON inventory_entries;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON inventory_entries;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON inventory_entries;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON inventory_entries;

-- 3. Grant full permissions to all user types
GRANT ALL ON inventory_entries TO authenticated;
GRANT ALL ON inventory_entries TO anon;
GRANT ALL ON inventory_entries TO service_role;

-- 4. Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 5. Verify RLS is disabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'inventory_entries';

-- 6. Check table permissions
SELECT 
    grantee,
    privilege_type
FROM information_schema.table_privileges 
WHERE table_name = 'inventory_entries' 
AND table_schema = 'public';

-- 7. Show table structure for verification
SELECT 
    'inventory_entries columns' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'inventory_entries' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 9. Show success message
SELECT 'inventory_entries RLS fix completed successfully' as status;
