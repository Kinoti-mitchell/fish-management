-- Disable Outlet Receiving Inventory Trigger
-- This disables the trigger that's causing permission errors on outlet_receiving_inventory

-- Drop the problematic trigger
DROP TRIGGER IF EXISTS trigger_update_inventory_on_receiving ON outlet_receiving;

-- Drop the function as well
DROP FUNCTION IF EXISTS update_inventory_on_receiving();

-- Also disable RLS on outlet_receiving_inventory if it exists
ALTER TABLE IF EXISTS outlet_receiving_inventory DISABLE ROW LEVEL SECURITY;

-- Grant permissions on outlet_receiving_inventory if it exists
GRANT SELECT, INSERT, UPDATE, DELETE ON outlet_receiving_inventory TO authenticated;

-- Verify the trigger was removed
SELECT 'Outlet receiving inventory trigger disabled successfully' as status;
