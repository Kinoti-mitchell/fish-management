-- Complete Fix for Permissions and Entry Code Column
-- Run this in your Supabase SQL Editor

-- Step 1: Add entry_code column to warehouse_entries if it doesn't exist
ALTER TABLE warehouse_entries 
ADD COLUMN IF NOT EXISTS entry_code VARCHAR(20);

-- Step 2: Disable RLS on all tables
ALTER TABLE farmers DISABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE processing_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE sorting_batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE sorting_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE size_class_thresholds DISABLE ROW LEVEL SECURITY;
ALTER TABLE sorted_fish_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Step 3: Grant full permissions to all roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Step 4: Grant schema usage
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Step 5: Grant sequence permissions
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Step 6: Grant function permissions
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Step 7: Drop all existing RLS policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- Step 8: Add unique constraint to entry_code (after granting permissions)
ALTER TABLE warehouse_entries 
ADD CONSTRAINT IF NOT EXISTS warehouse_entries_entry_code_unique UNIQUE (entry_code);

-- Step 9: Generate entry codes for existing entries that don't have them
UPDATE warehouse_entries 
SET entry_code = 'WE' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 3, '0')
WHERE entry_code IS NULL OR entry_code = '';

-- Step 10: Verify the setup
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled,
    CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as status
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Step 11: Check entry codes
SELECT id, entry_code, created_at 
FROM warehouse_entries 
ORDER BY created_at 
LIMIT 10;
