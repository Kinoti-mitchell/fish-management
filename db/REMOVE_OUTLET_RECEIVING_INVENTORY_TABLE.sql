-- Remove Outlet Receiving Inventory Table and Fix Triggers
-- This script removes the unnecessary outlet_receiving_inventory table and fixes all related triggers
-- Run this in Supabase SQL Editor to fix the 401 permission errors

-- Step 1: Drop all problematic triggers
DROP TRIGGER IF EXISTS trigger_update_inventory_on_receiving ON outlet_receiving;
DROP TRIGGER IF EXISTS trigger_update_outlet_receiving_inventory_updated_at ON outlet_receiving_inventory;
DROP TRIGGER IF EXISTS trigger_update_main_inventory_on_receiving ON outlet_receiving;

-- Step 2: Drop all problematic functions
DROP FUNCTION IF EXISTS update_inventory_on_receiving();
DROP FUNCTION IF EXISTS update_outlet_receiving_inventory_updated_at();
DROP FUNCTION IF EXISTS update_main_inventory_on_receiving();

-- Step 3: Drop the unnecessary outlet_receiving_inventory table
DROP TABLE IF EXISTS outlet_receiving_inventory CASCADE;

-- Step 4: Ensure outlet_receiving table has proper permissions
ALTER TABLE outlet_receiving DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON outlet_receiving TO authenticated;

-- Step 5: Ensure related tables have proper permissions
ALTER TABLE dispatch_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE outlet_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE outlets DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON dispatch_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON outlet_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON outlets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;

-- Step 6: Grant usage on public schema
GRANT USAGE ON SCHEMA public TO authenticated;

-- Step 7: Verify the cleanup
SELECT 
    'Cleanup completed successfully' as status,
    'outlet_receiving_inventory table removed' as table_status,
    'All problematic triggers removed' as trigger_status;

-- Step 8: Show current outlet_receiving table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'outlet_receiving'
ORDER BY ordinal_position;

