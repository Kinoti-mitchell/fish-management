-- Fix RLS Policies - Remove infinite recursion
-- Run this in Supabase SQL Editor

-- First, disable RLS temporarily to fix the policies
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Anyone can view user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies
CREATE POLICY "Enable read access for authenticated users" ON profiles
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON user_roles
    FOR SELECT USING (true);

-- Create admin profile if it doesn't exist
INSERT INTO profiles (
    id,
    first_name,
    last_name,
    role,
    is_active,
    email,
    created_at,
    updated_at
) VALUES (
    '1a31181e-9b3d-4928-8349-f5b38466e5fb',
    'Mitchell',
    'Kinoti',
    'admin',
    true,
    'mitchellkinoti@gmail.com',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    email = EXCLUDED.email,
    updated_at = NOW();

-- Verify the fix
SELECT 'RLS policies fixed!' as status;
SELECT id, email, first_name, last_name, role FROM profiles;
