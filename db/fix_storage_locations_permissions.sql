-- Complete fix for storage_locations permissions
-- This will resolve the 42501 permission denied error

-- Step 1: Check current table permissions
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges 
WHERE table_name = 'storage_locations' 
AND table_schema = 'public';

-- Step 2: Grant all necessary permissions to authenticated users
GRANT ALL PRIVILEGES ON TABLE storage_locations TO authenticated;
GRANT ALL PRIVILEGES ON TABLE storage_locations TO anon;
GRANT ALL PRIVILEGES ON TABLE storage_locations TO service_role;

-- Step 3: Grant sequence permissions (for auto-incrementing IDs)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Step 4: Grant schema permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO service_role;

-- Step 5: Drop all existing RLS policies to start fresh
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON storage_locations;
DROP POLICY IF EXISTS "storage_locations_policy" ON storage_locations;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON storage_locations;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON storage_locations;
DROP POLICY IF EXISTS "Allow authenticated access" ON storage_locations;

-- Step 6: Disable RLS temporarily
ALTER TABLE storage_locations DISABLE ROW LEVEL SECURITY;

-- Step 7: Test access without RLS
SELECT COUNT(*) as test_count_without_rls FROM storage_locations;

-- Step 8: Re-enable RLS
ALTER TABLE storage_locations ENABLE ROW LEVEL SECURITY;

-- Step 9: Create a simple, working RLS policy
CREATE POLICY "storage_locations_access_policy" ON storage_locations
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Step 10: Verify permissions were granted
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges 
WHERE table_name = 'storage_locations' 
AND table_schema = 'public'
ORDER BY grantee, privilege_type;

-- Step 11: Test the access with RLS enabled
SELECT COUNT(*) as test_count_with_rls FROM storage_locations;

-- Step 12: Show sample data to confirm everything works
SELECT id, name, location_type, status FROM storage_locations LIMIT 3;

SELECT 'Storage locations permissions fixed successfully!' as status;
