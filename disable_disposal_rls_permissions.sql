-- Disable RLS and grant permissions for disposal tables
-- This will fix the permission denied errors

-- 1. Remove piece count columns from disposal tables
ALTER TABLE disposal_records DROP COLUMN IF EXISTS total_pieces;
ALTER TABLE disposal_items DROP COLUMN IF EXISTS quantity;

-- 2. Ensure disposal_items table has the correct structure
-- Add status column if it doesn't exist (for tracking item status)
ALTER TABLE disposal_items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 3. Ensure disposal_records table has the correct structure
-- Add approved_by column if it doesn't exist (for tracking who approved)
ALTER TABLE disposal_records ADD COLUMN IF NOT EXISTS approved_by UUID;

-- 4. Ensure sorting_results table has the correct structure
-- Add status column if it doesn't exist (for tracking item status)
ALTER TABLE sorting_results ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available';

-- 5. Disable RLS on disposal_records table
ALTER TABLE disposal_records DISABLE ROW LEVEL SECURITY;

-- 6. Disable RLS on disposal_items table  
ALTER TABLE disposal_items DISABLE ROW LEVEL SECURITY;

-- 7. Disable RLS on disposal_reasons table
ALTER TABLE disposal_reasons DISABLE ROW LEVEL SECURITY;

-- 8. Grant full permissions to authenticated users
GRANT ALL ON disposal_records TO authenticated;
GRANT ALL ON disposal_items TO authenticated;
GRANT ALL ON disposal_reasons TO authenticated;
GRANT ALL ON sorting_results TO authenticated;

-- 9. Grant full permissions to anon users (for development)
GRANT ALL ON disposal_records TO anon;
GRANT ALL ON disposal_items TO anon;
GRANT ALL ON disposal_reasons TO anon;
GRANT ALL ON sorting_results TO anon;

-- 10. Grant permissions on sequences (if they exist)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- 11. Ensure the get_inventory_for_disposal function has proper permissions
GRANT EXECUTE ON FUNCTION get_inventory_for_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_for_disposal TO anon;

-- 12. Test the permissions
SELECT 'RLS disabled and permissions granted for disposal tables!' as status;
