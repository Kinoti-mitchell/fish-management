-- =====================================================
-- RIO FISH FARM - Complete Database Fix (Idempotent)
-- =====================================================
-- This script fixes all database issues including:
-- 1. RLS policy recursion errors
-- 2. Missing tables and functions
-- 3. Proper role management setup
-- 4. Duplicate policy errors (idempotent policies/triggers)
-- =====================================================

-- =====================================================
-- DROP EXISTING POLICIES (SAFE RE-RUN)
-- =====================================================

-- Profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;

-- User roles table
DROP POLICY IF EXISTS "Everyone can view active roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;

-- User sessions table
DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Admins can view all sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can manage own sessions" ON user_sessions;

-- System config table
DROP POLICY IF EXISTS "Only admins can manage system config" ON system_config;

-- =====================================================
-- CREATE MISSING TABLES
-- =====================================================

-- User roles
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]',
    icon VARCHAR(50) DEFAULT 'Users',
    color VARCHAR(100) DEFAULT 'bg-gray-100 text-gray-800 border-gray-200',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    device_type VARCHAR(20) DEFAULT 'desktop',
    location VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System config
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'viewer',
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INSERT DEFAULT DATA
-- =====================================================

-- Default roles
INSERT INTO user_roles (name, display_name, description, permissions, icon, color) VALUES
('admin', 'Administrator', 'Full system access and control. Can manage all users, roles, and system settings.', '["*"]', 'Crown', 'bg-red-100 text-red-800 border-red-200'),
('processor', 'Fish Processor', 'Manages fish processing operations, quality control, and production workflows.', '["read:all", "write:processing", "write:quality", "read:inventory"]', 'Package', 'bg-blue-100 text-blue-800 border-blue-200'),
('farmer', 'Fish Farmer', 'Manages fish farming operations, pond management, and harvest scheduling.', '["read:farming", "write:farming", "read:harvests", "write:harvests"]', 'Tractor', 'bg-green-100 text-green-800 border-green-200'),
('outlet_manager', 'Outlet Manager', 'Manages retail outlets, customer sales, and inventory at point of sale.', '["read:sales", "write:sales", "read:customers", "write:customers", "read:inventory"]', 'Building', 'bg-purple-100 text-purple-800 border-purple-200'),
('warehouse_manager', 'Warehouse Manager', 'Oversees warehouse operations, stock management, and distribution logistics.', '["read:inventory", "write:inventory", "read:logistics", "write:logistics"]', 'Package', 'bg-orange-100 text-orange-800 border-orange-200'),
('viewer', 'Viewer', 'Read-only access to system data. Cannot modify any information.', '["read:basic"]', 'Eye', 'bg-gray-100 text-gray-800 border-gray-200')
ON CONFLICT (name) DO NOTHING;

-- Default config
INSERT INTO system_config (key, value, description) VALUES
('email_config', '{"provider": "sendgrid", "from_email": "noreply@riofish.com", "from_name": "RioFish System", "api_key": ""}', 'Email service configuration for sending notifications'),
('system_settings', '{"maintenance_mode": false, "max_file_size": "10MB", "session_timeout": 3600}', 'General system settings and preferences'),
('notification_settings', '{"email_notifications": true, "push_notifications": false, "sms_notifications": false}', 'User notification preferences')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Handle new user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, first_name, last_name, role, phone, is_active)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'first_name', 'Unknown'),
        COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'viewer'),
        NEW.raw_user_meta_data->>'phone',
        true
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check user permission
CREATE OR REPLACE FUNCTION check_user_permission(user_id UUID, required_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_role_name VARCHAR(50);
    role_permissions JSONB;
BEGIN
    SELECT role INTO user_role_name FROM profiles WHERE id = user_id;
    IF user_role_name IS NULL THEN RETURN FALSE; END IF;
    IF user_role_name = 'admin' THEN RETURN TRUE; END IF;

    SELECT permissions INTO role_permissions 
    FROM user_roles 
    WHERE name = user_role_name AND is_active = true;

    IF role_permissions IS NULL THEN RETURN FALSE; END IF;
    IF role_permissions ? '*' THEN RETURN TRUE; END IF;

    RETURN role_permissions ? required_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(user_id UUID)
RETURNS JSONB AS $$
DECLARE
    user_role_name VARCHAR(50);
    role_permissions JSONB;
BEGIN
    SELECT role INTO user_role_name FROM profiles WHERE id = user_id;
    IF user_role_name IS NULL THEN RETURN '[]'::JSONB; END IF;

    SELECT permissions INTO role_permissions 
    FROM user_roles 
    WHERE name = user_role_name AND is_active = true;

    RETURN COALESCE(role_permissions, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audit user action
CREATE OR REPLACE FUNCTION audit_user_action(
    action_name TEXT,
    table_name TEXT,
    record_id UUID DEFAULT NULL,
    old_data JSONB DEFAULT NULL,
    new_data JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
    VALUES (
        auth.uid(),
        action_name,
        table_name,
        record_id,
        old_data,
        new_data,
        inet_client_addr(),
        current_setting('request.headers', true)::json->>'user-agent'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- RLS
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        auth.jwt() ->> 'role' = 'admin'
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE USING (
        auth.jwt() ->> 'role' = 'admin'
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

CREATE POLICY "Admins can insert profiles" ON profiles
    FOR INSERT WITH CHECK (
        auth.jwt() ->> 'role' = 'admin'
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- User roles
CREATE POLICY "Everyone can view active roles" ON user_roles
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage all roles" ON user_roles
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'admin'
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- User sessions
CREATE POLICY "Users can view own sessions" ON user_sessions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all sessions" ON user_sessions
    FOR SELECT USING (
        auth.jwt() ->> 'role' = 'admin'
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

CREATE POLICY "Users can manage own sessions" ON user_sessions
    FOR ALL USING (user_id = auth.uid());

-- System config
CREATE POLICY "Only admins can manage system config" ON system_config
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'admin'
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_name ON user_roles(name);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);

-- =====================================================
-- GRANTS
-- =====================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =====================================================
-- VIEWS
-- =====================================================

CREATE OR REPLACE VIEW user_management_view AS
SELECT 
    p.id,
    p.first_name,
    p.last_name,
    au.email,
    p.role,
    p.phone,
    p.is_active,
    p.last_login,
    p.created_at,
    p.updated_at,
    ur.display_name as role_display_name,
    ur.description as role_description,
    ur.icon as role_icon,
    ur.color as role_color,
    ur.permissions as role_permissions
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
LEFT JOIN user_roles ur ON p.role = ur.name
WHERE ur.is_active = true OR p.role = 'admin';

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'RIO FISH FARM DATABASE SETUP COMPLETE!';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '✅ All tables created/updated';
    RAISE NOTICE '✅ RLS policies fixed (no recursion, no duplicates)';
    RAISE NOTICE '✅ Default roles and data inserted';
    RAISE NOTICE '✅ Functions and triggers created';
    RAISE NOTICE '✅ Permissions granted';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Your Fish Management PWA is now ready to use!';
    RAISE NOTICE '=====================================================';
END $$;
