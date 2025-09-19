-- Disable Row Level Security (RLS) on all tables
-- Run this in your Supabase SQL Editor

-- Disable RLS on all tables
ALTER TABLE farmers DISABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE processing_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE sorting_batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE sorting_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE size_class_thresholds DISABLE ROW LEVEL SECURITY;
ALTER TABLE sorted_fish_items DISABLE ROW LEVEL SECURITY;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Enable read access for all users" ON farmers;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON farmers;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON farmers;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON farmers;

DROP POLICY IF EXISTS "Enable read access for all users" ON warehouse_entries;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON warehouse_entries;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON warehouse_entries;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON warehouse_entries;

DROP POLICY IF EXISTS "Enable read access for all users" ON processing_records;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON processing_records;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON processing_records;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON processing_records;

DROP POLICY IF EXISTS "Enable read access for all users" ON sorting_batches;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON sorting_batches;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON sorting_batches;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON sorting_batches;

DROP POLICY IF EXISTS "Enable read access for all users" ON sorting_results;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON sorting_results;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON sorting_results;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON sorting_results;

DROP POLICY IF EXISTS "Enable read access for all users" ON inventory;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON inventory;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON inventory;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON inventory;

DROP POLICY IF EXISTS "Enable read access for all users" ON storage_locations;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON storage_locations;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON storage_locations;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON storage_locations;

DROP POLICY IF EXISTS "Enable read access for all users" ON size_class_thresholds;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON size_class_thresholds;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON size_class_thresholds;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON size_class_thresholds;

DROP POLICY IF EXISTS "Enable read access for all users" ON sorted_fish_items;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON sorted_fish_items;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON sorted_fish_items;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON sorted_fish_items;

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'farmers', 'warehouse_entries', 'processing_records', 
    'sorting_batches', 'sorting_results', 'inventory', 
    'inventory_entries', 'storage_locations', 'size_class_thresholds', 
    'sorted_fish_items'
)
ORDER BY tablename;
