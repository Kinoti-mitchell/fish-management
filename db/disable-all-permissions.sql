-- Disable Row Level Security (RLS) on ALL tables
-- This will remove all permission restrictions

-- Disable RLS on all main tables
ALTER TABLE IF EXISTS farmers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS warehouse_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS processing_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sorting_batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sorting_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS storage_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS size_class_thresholds DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sorted_fish_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auth.users DISABLE ROW LEVEL SECURITY;

-- Grant full access to all tables for all users
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant sequence permissions
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant function permissions
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Drop all existing policies (if any)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- Verify RLS is disabled on all tables
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled,
    CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as status
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
