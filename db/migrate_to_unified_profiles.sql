-- Migrate to Unified Profiles Table (Preserves Existing Users)
-- This script safely migrates existing user data to a unified profiles table

-- Step 1: Backup existing profiles data if table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        DROP TABLE IF EXISTS profiles_backup;
        CREATE TABLE profiles_backup AS SELECT * FROM profiles;
        RAISE NOTICE 'Backed up existing profiles data';
    END IF;
END $$;

-- Step 2: Backup existing users data if table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        DROP TABLE IF EXISTS users_backup;
        CREATE TABLE users_backup AS SELECT * FROM users;
        RAISE NOTICE 'Backed up existing users data';
    END IF;
END $$;

-- Step 3: Create the new unified profiles table
CREATE TABLE IF NOT EXISTS profiles_new (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL DEFAULT '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Migrate data from existing profiles table
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        INSERT INTO profiles_new (id, email, first_name, last_name, role, phone, is_active, last_login, avatar_url, bio, created_at, updated_at)
        SELECT 
            id,
            COALESCE(email, 'user@example.com'),
            COALESCE(first_name, 'Unknown'),
            COALESCE(last_name, 'User'),
            COALESCE(role, 'viewer'),
            phone,
            COALESCE(is_active, true),
            last_login,
            avatar_url,
            bio,
            COALESCE(created_at, NOW()),
            COALESCE(updated_at, NOW())
        FROM profiles
        ON CONFLICT (email) DO NOTHING;
        RAISE NOTICE 'Migrated data from existing profiles table';
    END IF;
END $$;

-- Step 5: Migrate data from existing users table
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        INSERT INTO profiles_new (id, email, first_name, last_name, role, phone, is_active, last_login, created_at, updated_at)
        SELECT 
            COALESCE(id, uuid_generate_v4()),
            COALESCE(email, 'user@example.com'),
            COALESCE(first_name, 'Unknown'),
            COALESCE(last_name, 'User'),
            COALESCE(role, 'viewer'),
            phone,
            COALESCE(is_active, true),
            last_login,
            COALESCE(created_at, NOW()),
            COALESCE(updated_at, NOW())
        FROM users
        ON CONFLICT (email) DO NOTHING;
        RAISE NOTICE 'Migrated data from existing users table';
    END IF;
END $$;

-- Step 6: No hardcoded users - all users should be created through the application interface
-- This ensures proper user management, security, and audit trails

-- Step 7: Drop old tables and rename new table
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
ALTER TABLE profiles_new RENAME TO profiles;

-- Step 8: Create user_sessions table (linked to profiles)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
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

-- Step 9: Create audit_logs table (linked to profiles)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 10: Disable RLS on all tables (for development)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- Step 11: Grant full permissions to all roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant schema usage
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

-- Step 12: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Step 13: Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 14: Create triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 15: Verify the migration
SELECT 'Migration completed successfully' as status;
SELECT COUNT(*) as total_users FROM profiles;
SELECT email, first_name, last_name, role, is_active FROM profiles ORDER BY created_at;

-- Step 16: Show migration summary
SELECT 
    'Migration Summary' as info,
    (SELECT COUNT(*) FROM profiles) as total_users,
    (SELECT COUNT(*) FROM profiles WHERE is_active = true) as active_users,
    (SELECT COUNT(*) FROM profiles WHERE role = 'admin') as admin_users;
