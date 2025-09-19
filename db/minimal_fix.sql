-- Minimal Database Fix - No is_active column references
-- Run this in Supabase SQL Editor

-- STEP 1: Create user_sessions table (simple version)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 2: Create system_config table (simple version)
CREATE TABLE IF NOT EXISTS system_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 3: Create profiles table (simple version)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 4: Create user_roles table (simple version)
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]',
    icon TEXT,
    color TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 5: Insert default user roles (without referencing is_active in policies)
INSERT INTO user_roles (name, display_name, description, permissions, icon, color, is_active, created_at, updated_at)
VALUES 
    ('admin', 'Administrator', 'Full system access and control. Can manage all users, roles, and system settings.', '["*"]', 'Crown', 'bg-red-100 text-red-800 border-red-200', true, NOW(), NOW()),
    ('processor', 'Fish Processor', 'Manages fish processing operations, quality control, and production workflows.', '["read:all", "write:processing", "write:quality", "read:inventory"]', 'Package', 'bg-blue-100 text-blue-800 border-blue-200', true, NOW(), NOW()),
    ('farmer', 'Fish Farmer', 'Manages fish farming operations, pond management, and harvest scheduling.', '["read:farming", "write:farming", "read:harvests", "write:harvests"]', 'Tractor', 'bg-green-100 text-green-800 border-green-200', true, NOW(), NOW()),
    ('outlet_manager', 'Outlet Manager', 'Manages retail outlets, customer sales, and inventory at point of sale.', '["read:sales", "write:sales", "read:customers", "write:customers", "read:inventory"]', 'Building', 'bg-purple-100 text-purple-800 border-purple-200', true, NOW(), NOW()),
    ('warehouse_manager', 'Warehouse Manager', 'Oversees warehouse operations, stock management, and distribution logistics.', '["read:inventory", "write:inventory", "read:logistics", "write:logistics"]', 'Package', 'bg-orange-100 text-orange-800 border-orange-200', true, NOW(), NOW()),
    ('viewer', 'Viewer', 'Read-only access to system data. Cannot modify any information.', '["read:basic"]', 'Eye', 'bg-gray-100 text-gray-800 border-gray-200', true, NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    permissions = EXCLUDED.permissions,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- STEP 6: Create your admin profile
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

-- STEP 7: Create manager profile
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
    'e716423e-93b7-424e-8ec2-2efed4deb6f8',
    'Manager',
    'User',
    'processor',
    true,
    'manager@riofish.com',
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

-- STEP 8: Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- STEP 9: Create simple RLS policies (without is_active references)
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

DROP POLICY IF EXISTS "Anyone can view active user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;

DROP POLICY IF EXISTS "Users can view their own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Admins can manage all sessions" ON user_sessions;

DROP POLICY IF EXISTS "Anyone can view active system config" ON system_config;
DROP POLICY IF EXISTS "Admins can manage system config" ON system_config;

-- Create simple policies for profiles
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert profiles" ON profiles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role = 'admin'
        )
    );

CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role = 'admin'
        )
    );

-- Create simple policies for user_roles
CREATE POLICY "Anyone can view user roles" ON user_roles
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage user roles" ON user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role = 'admin'
        )
    );

-- Create simple policies for user_sessions
CREATE POLICY "Users can view their own sessions" ON user_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON user_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON user_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all sessions" ON user_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role = 'admin'
        )
    );

-- Create simple policies for system_config
CREATE POLICY "Anyone can view system config" ON system_config
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage system config" ON system_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role = 'admin'
        )
    );

-- STEP 10: Verify everything works
SELECT 'Database setup completed successfully!' as status;

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'user_roles', 'user_sessions', 'system_config')
ORDER BY table_name;

SELECT 
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.role,
    p.is_active
FROM profiles p
ORDER BY p.created_at;
