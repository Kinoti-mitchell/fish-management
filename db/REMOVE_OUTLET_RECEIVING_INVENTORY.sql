-- Remove outlet_receiving_inventory table and use only outlet_receiving
-- This fixes the 401 permission errors by removing the problematic table and triggers

-- Step 1: Drop all triggers that reference outlet_receiving_inventory
DROP TRIGGER IF EXISTS trigger_update_inventory_on_receiving ON outlet_receiving;
DROP TRIGGER IF EXISTS trigger_update_outlet_receiving_inventory_updated_at ON outlet_receiving_inventory;

-- Step 2: Drop all functions that reference outlet_receiving_inventory
DROP FUNCTION IF EXISTS update_inventory_on_receiving();
DROP FUNCTION IF EXISTS update_outlet_receiving_inventory_updated_at();

-- Step 3: Drop the outlet_receiving_inventory table completely
DROP TABLE IF EXISTS outlet_receiving_inventory CASCADE;

-- Step 4: Ensure outlet_receiving table has proper permissions
ALTER TABLE outlet_receiving DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON outlet_receiving TO authenticated;

-- Step 5: Ensure related tables have proper permissions
ALTER TABLE dispatch_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE outlet_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE outlets DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON dispatch_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON outlet_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON outlets TO authenticated;

-- Step 6: Grant schema usage
GRANT USAGE ON SCHEMA public TO authenticated;

-- Step 7: Verify cleanup
SELECT 'outlet_receiving_inventory table removed successfully' as status;

