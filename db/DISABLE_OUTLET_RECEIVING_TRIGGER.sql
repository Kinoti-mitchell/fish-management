-- Disable Outlet Receiving Trigger
-- This disables the trigger that's causing permission errors on outlet_receiving_inventory

-- Drop the problematic trigger
DROP TRIGGER IF EXISTS trigger_update_inventory_on_receiving ON outlet_receiving;

-- Drop the function as well
DROP FUNCTION IF EXISTS update_inventory_on_receiving();

-- Verify the trigger was removed
SELECT 'Trigger disabled successfully' as status;
