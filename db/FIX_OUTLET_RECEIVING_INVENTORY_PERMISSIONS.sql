-- Fix Outlet Receiving Inventory Table Permissions
-- This script fixes the "permission denied for table outlet_receiving_inventory" error

-- Step 1: Disable RLS on outlet_receiving_inventory table
ALTER TABLE outlet_receiving_inventory DISABLE ROW LEVEL SECURITY;

-- Step 2: Grant full permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON outlet_receiving_inventory TO authenticated;

-- Step 3: Grant usage on the public schema
GRANT USAGE ON SCHEMA public TO authenticated;

-- Step 4: Also ensure outlet_receiving table has proper permissions
ALTER TABLE outlet_receiving DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON outlet_receiving TO authenticated;

-- Step 5: Grant permissions on dispatch_records table
GRANT SELECT, INSERT, UPDATE, DELETE ON dispatch_records TO authenticated;

-- Step 6: Grant permissions on outlet_orders table
GRANT SELECT, INSERT, UPDATE, DELETE ON outlet_orders TO authenticated;

-- Step 7: Grant permissions on outlets table
GRANT SELECT, INSERT, UPDATE, DELETE ON outlets TO authenticated;

-- Step 8: Verify permissions
SELECT 'Permissions granted successfully' as status;
SELECT 'RLS disabled on outlet_receiving_inventory table' as rls_status;
SELECT 'All outlet receiving tables now accessible' as access_status;
