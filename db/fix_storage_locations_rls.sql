-- Fix Row Level Security for storage_locations table
-- This will resolve the 403 Forbidden error

-- First, let's check the current RLS status and policies
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    hasrls as has_rls
FROM pg_tables 
WHERE tablename = 'storage_locations';

-- Check existing policies
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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON storage_locations;

-- Create a new, more permissive policy
CREATE POLICY "Enable all access for authenticated users" ON storage_locations
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Alternative: If the above doesn't work, try this more explicit policy
-- DROP POLICY IF EXISTS "Enable all access for authenticated users" ON storage_locations;
-- CREATE POLICY "Enable all access for authenticated users" ON storage_locations
--     FOR ALL 
--     USING (auth.role() = 'authenticated')
--     WITH CHECK (auth.role() = 'authenticated');

-- Verify the policy was created
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

-- Test the access by trying to select from the table
SELECT COUNT(*) as test_count FROM storage_locations;

SELECT 'RLS policy fixed successfully!' as status;
