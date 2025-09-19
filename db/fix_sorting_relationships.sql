-- Fix Sorting Module Relationship Issues
-- This script fixes the relationship between sorting_batches and users tables

-- 1. First, ensure we have a proper public.users table that mirrors auth.users
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role TEXT DEFAULT 'viewer',
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create a function to sync auth.users with public.users
CREATE OR REPLACE FUNCTION sync_user_to_public()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, first_name, last_name, role, phone, is_active, last_login, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'viewer'),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        true,
        NEW.last_sign_in_at,
        NEW.created_at,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        phone = EXCLUDED.phone,
        is_active = EXCLUDED.is_active,
        last_login = EXCLUDED.last_login,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger to sync users
DROP TRIGGER IF EXISTS sync_user_to_public_trigger ON auth.users;
CREATE TRIGGER sync_user_to_public_trigger
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_to_public();

-- 4. Sync existing users
INSERT INTO public.users (id, email, first_name, last_name, role, phone, is_active, last_login, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'first_name', ''),
    COALESCE(au.raw_user_meta_data->>'last_name', ''),
    COALESCE(au.raw_user_meta_data->>'role', 'viewer'),
    COALESCE(au.raw_user_meta_data->>'phone', ''),
    true,
    au.last_sign_in_at,
    au.created_at,
    NOW()
FROM auth.users au
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone,
    is_active = EXCLUDED.is_active,
    last_login = EXCLUDED.last_login,
    updated_at = NOW();

-- 5. Fix the sorting_batches table to reference public.users instead of auth.users
-- First, drop the existing foreign key constraint
ALTER TABLE sorting_batches DROP CONSTRAINT IF EXISTS sorting_batches_sorted_by_fkey;

-- Add the new foreign key constraint to public.users
ALTER TABLE sorting_batches 
ADD CONSTRAINT sorting_batches_sorted_by_fkey 
FOREIGN KEY (sorted_by) REFERENCES public.users(id);

-- 6. Fix the size_class_thresholds table to reference public.users
ALTER TABLE size_class_thresholds DROP CONSTRAINT IF EXISTS size_class_thresholds_created_by_fkey;
ALTER TABLE size_class_thresholds 
ADD CONSTRAINT size_class_thresholds_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.users(id);

-- 7. Enable RLS on public.users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 8. Create permissive policies for public.users
DROP POLICY IF EXISTS "Allow all operations on public users" ON public.users;
CREATE POLICY "Allow all operations on public users" ON public.users
    FOR ALL USING (true) WITH CHECK (true);

-- 9. Grant permissions on public.users
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.users TO anon;

-- 10. Fix any missing columns in sorted_fish_items table
ALTER TABLE sorted_fish_items ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT uuid_generate_v4();

-- 11. Ensure all sorting tables have proper permissions
GRANT ALL ON size_class_thresholds TO authenticated;
GRANT ALL ON sorting_batches TO authenticated;
GRANT ALL ON sorted_fish_items TO authenticated;
GRANT ALL ON sorting_results TO authenticated;

GRANT ALL ON size_class_thresholds TO anon;
GRANT ALL ON sorting_batches TO anon;
GRANT ALL ON sorted_fish_items TO anon;
GRANT ALL ON sorting_results TO anon;

-- 12. Create permissive policies for all sorting tables
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

-- 13. Insert a system user for testing if needed
INSERT INTO public.users (id, email, first_name, last_name, role, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000000'::UUID,
    'system@example.com',
    'System',
    'User',
    'admin',
    true
) ON CONFLICT (id) DO NOTHING;

-- 14. Verification queries
SELECT 'Users table created and synced' as status, COUNT(*) as count FROM public.users;
SELECT 'Sorting batches accessible' as status, COUNT(*) as count FROM sorting_batches;
SELECT 'Size class thresholds accessible' as status, COUNT(*) as count FROM size_class_thresholds;
