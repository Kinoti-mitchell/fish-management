-- Fix RLS for processing_records table
-- Run this in Supabase SQL Editor

-- Disable RLS temporarily for processing_records
ALTER TABLE processing_records DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Enable read access for all users" ON processing_records;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON processing_records;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON processing_records;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON processing_records;

-- Re-enable RLS
ALTER TABLE processing_records ENABLE ROW LEVEL SECURITY;

-- Create simple policies that allow access
CREATE POLICY "Enable read access for all users" ON processing_records
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON processing_records
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON processing_records
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON processing_records
    FOR DELETE USING (auth.role() = 'authenticated');

-- Verify the fix
SELECT 'processing_records RLS policies fixed!' as status;
