-- Fix User Profile and Navigation Issues
-- Run this in Supabase SQL Editor

-- First, let's check what users and profiles exist
SELECT 
    au.id,
    au.email,
    au.created_at as auth_created,
    p.first_name,
    p.last_name,
    p.role,
    p.is_active,
    p.created_at as profile_created
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
ORDER BY au.created_at;

-- Create or update profile for mitchellkinoti@gmail.com (the logged-in user)
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

-- Create or update profile for manager@riofish.com
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

-- Create default user roles if they don't exist
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

-- Verify the setup
SELECT 
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.role,
    p.is_active,
    ur.display_name as role_display_name,
    ur.permissions
FROM profiles p
LEFT JOIN user_roles ur ON p.role = ur.name
WHERE p.id IN ('1a31181e-9b3d-4928-8349-f5b38466e5fb', 'e716423e-93b7-424e-8ec2-2efed4deb6f8');

-- Check if all required tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'user_roles', 'user_sessions', 'system_config')
ORDER BY table_name;
