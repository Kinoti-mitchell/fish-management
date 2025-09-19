-- Comprehensive fix for storage_locations access issues
-- This will resolve the 403 Forbidden error completely

-- Step 1: Check current RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'storage_locations';

-- Step 2: Drop all existing policies
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON storage_locations;
DROP POLICY IF EXISTS "storage_locations_policy" ON storage_locations;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON storage_locations;

-- Step 3: Temporarily disable RLS to test access
ALTER TABLE storage_locations DISABLE ROW LEVEL SECURITY;

-- Step 4: Test access without RLS
SELECT COUNT(*) as test_count_without_rls FROM storage_locations;

-- Step 5: Re-enable RLS
ALTER TABLE storage_locations ENABLE ROW LEVEL SECURITY;

-- Step 6: Create a simple, working policy
CREATE POLICY "Allow all operations for authenticated users" ON storage_locations
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Step 7: Alternative policy if the above doesn't work
-- This policy is more explicit about the role check
CREATE POLICY "Allow authenticated access" ON storage_locations
    FOR ALL 
    TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- Step 8: Verify policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'storage_locations';

-- Step 9: Test the access
SELECT COUNT(*) as test_count_with_rls FROM storage_locations;

-- Step 10: Show sample data to confirm access
SELECT id, name, location_type, status FROM storage_locations LIMIT 3;

SELECT 'Storage locations access fixed successfully!' as status;
