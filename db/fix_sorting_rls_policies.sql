-- Fix RLS policies for sorting tables to allow access
-- This temporarily makes the policies more permissive for testing

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view size class thresholds" ON size_class_thresholds;
DROP POLICY IF EXISTS "Admins can manage size class thresholds" ON size_class_thresholds;
DROP POLICY IF EXISTS "Users can view sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Users can create sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Users can update their own sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Users can view sorted fish items" ON sorted_fish_items;
DROP POLICY IF EXISTS "Users can create sorted fish items" ON sorted_fish_items;
DROP POLICY IF EXISTS "Users can view sorting results" ON sorting_results;

-- Create more permissive policies for testing
CREATE POLICY "Allow all operations on size_class_thresholds" ON size_class_thresholds
    FOR ALL USING (true);

CREATE POLICY "Allow all operations on sorting_batches" ON sorting_batches
    FOR ALL USING (true);

CREATE POLICY "Allow all operations on sorted_fish_items" ON sorted_fish_items
    FOR ALL USING (true);

CREATE POLICY "Allow all operations on sorting_results" ON sorting_results
    FOR ALL USING (true);

-- Grant necessary permissions to authenticated users
GRANT ALL ON size_class_thresholds TO authenticated;
GRANT ALL ON sorting_batches TO authenticated;
GRANT ALL ON sorted_fish_items TO authenticated;
GRANT ALL ON sorting_results TO authenticated;

-- Grant permissions to anon users as well (for testing)
GRANT ALL ON size_class_thresholds TO anon;
GRANT ALL ON sorting_batches TO anon;
GRANT ALL ON sorted_fish_items TO anon;
GRANT ALL ON sorting_results TO anon;
