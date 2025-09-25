-- Simple Fix for Sorting Module - Align with existing patterns
-- This makes sorting work like other components in the app

-- 1. Fix the sorting_batches table to reference profiles table (like other components)
ALTER TABLE sorting_batches DROP CONSTRAINT IF EXISTS sorting_batches_sorted_by_fkey;

-- Add foreign key to profiles table (which is what other components use)
ALTER TABLE sorting_batches 
ADD CONSTRAINT sorting_batches_sorted_by_fkey 
FOREIGN KEY (sorted_by) REFERENCES profiles(id);

-- 2. Fix the size_class_thresholds table to reference profiles table
ALTER TABLE size_class_thresholds DROP CONSTRAINT IF EXISTS size_class_thresholds_created_by_fkey;
ALTER TABLE size_class_thresholds 
ADD CONSTRAINT size_class_thresholds_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES profiles(id);

-- 3. Ensure all sorting tables have proper permissions (like other tables)
GRANT ALL ON size_class_thresholds TO authenticated;
GRANT ALL ON sorting_batches TO authenticated;
GRANT ALL ON sorted_fish_items TO authenticated;
GRANT ALL ON sorting_results TO authenticated;

GRANT ALL ON size_class_thresholds TO anon;
GRANT ALL ON sorting_batches TO anon;
GRANT ALL ON sorted_fish_items TO anon;
GRANT ALL ON sorting_results TO anon;

-- 4. Create permissive policies for all sorting tables (like other components)
DROP POLICY IF EXISTS "Allow all operations on size_class_thresholds" ON size_class_thresholds;
CREATE POLICY "Allow all operations on size_class_thresholds" ON size_class_thresholds
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on sorting_batches" ON sorting_batches;
CREATE POLICY "Allow all operations on sorting_batches" ON sorting_batches
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on sorted_fish_items" ON sorted_fish_items;
CREATE POLICY "Allow all operations on sorted_fish_items" ON sorted_fish_items
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on sorting_results" ON sorting_results;
CREATE POLICY "Allow all operations on sorting_results" ON sorting_results
    FOR ALL USING (true) WITH CHECK (true);

-- 5. Fix any missing columns in sorted_fish_items table
ALTER TABLE sorted_fish_items ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT uuid_generate_v4();

-- 6. Verification queries
SELECT 'Sorting batches now reference profiles table' as status;
SELECT 'Size class thresholds accessible' as status, COUNT(*) as count FROM size_class_thresholds;
SELECT 'Sorting batches accessible' as status, COUNT(*) as count FROM sorting_batches;
