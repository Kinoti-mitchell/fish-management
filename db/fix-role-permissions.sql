-- Fix Role Permissions for Navigation System
-- This script updates the role permissions to ensure proper navigation access

-- Update processor role to include read:basic for dashboard and reports access
UPDATE user_roles 
SET permissions = '["read:all", "write:processing", "write:quality", "read:inventory", "read:basic"]'
WHERE name = 'processor';

-- Update warehouse_manager role to include read:basic for dashboard and reports access
UPDATE user_roles 
SET permissions = '["read:inventory", "write:inventory", "read:logistics", "write:logistics", "read:basic"]'
WHERE name = 'warehouse_manager';

-- Update outlet_manager role to include read:basic for dashboard and reports access
UPDATE user_roles 
SET permissions = '["read:sales", "write:sales", "read:customers", "write:customers", "read:inventory", "read:basic"]'
WHERE name = 'outlet_manager';

-- Verify the updates
SELECT 
    name,
    display_name,
    permissions
FROM user_roles 
ORDER BY name;
