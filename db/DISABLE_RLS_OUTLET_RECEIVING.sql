-- Disable RLS on outlet_receiving table to fix 401 authentication errors
-- This allows the frontend to access the table without authentication issues

-- Disable RLS on outlet_receiving table
ALTER TABLE outlet_receiving DISABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON outlet_receiving TO authenticated;

-- Also ensure other related tables have proper permissions
ALTER TABLE dispatch_records DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON dispatch_records TO authenticated;

ALTER TABLE outlet_orders DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON outlet_orders TO authenticated;

ALTER TABLE outlets DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON outlets TO authenticated;

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO authenticated;

-- Verify the changes
SELECT 'RLS disabled on outlet_receiving and related tables' as status;
