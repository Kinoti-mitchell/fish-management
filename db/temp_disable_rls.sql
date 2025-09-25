-- Temporary fix: Disable RLS for testing
-- Run this in Supabase SQL Editor

-- Disable RLS temporarily to allow access
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Verify tables are accessible
SELECT 'RLS disabled for testing' as status;
SELECT id, email, first_name, last_name, role FROM profiles;
SELECT name, display_name, permissions FROM user_roles;
