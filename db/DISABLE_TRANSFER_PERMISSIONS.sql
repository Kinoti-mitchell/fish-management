-- Disable Transfer Log Permissions
-- This script disables RLS and grants full permissions on transfer_log table

-- Step 1: Disable RLS on transfer_log table
ALTER TABLE transfer_log DISABLE ROW LEVEL SECURITY;

-- Step 2: Grant full permissions to authenticated users
GRANT ALL ON transfer_log TO authenticated;
GRANT ALL ON transfer_log TO anon;

-- Step 3: Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Step 4: Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION transfer_inventory_between_storage TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_inventory_between_storage TO anon;
GRANT EXECUTE ON FUNCTION get_transfer_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_transfer_history TO anon;

-- Step 5: Drop any existing RLS policies on transfer_log
DROP POLICY IF EXISTS "transfer_log_policy" ON transfer_log;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON transfer_log;
DROP POLICY IF EXISTS "Enable read access for all users" ON transfer_log;

-- Step 6: Ensure the table is accessible
ALTER TABLE transfer_log OWNER TO postgres;
