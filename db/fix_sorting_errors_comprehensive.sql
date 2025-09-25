-- Comprehensive Fix for Sorting Module Errors
-- This script addresses all the current database permission and schema issues

-- ==============================================
-- 1. FIX FOREIGN KEY RELATIONSHIP ISSUE
-- ==============================================
-- The issue is that sorting_batches references auth.users(id) but the frontend
-- is trying to join with a 'users' table that doesn't exist in the public schema.
-- We need to create a proper users table or fix the references.

-- Option 1: Create a public users table that mirrors auth.users
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

-- Create a function to sync auth.users with public.users
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
        COALESCE((NEW.raw_user_meta_data->>'is_active')::boolean, true),
        NEW.last_sign_in_at,
        NEW.created_at,
        NEW.updated_at
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

-- Create trigger to sync users
DROP TRIGGER IF EXISTS sync_user_trigger ON auth.users;
CREATE TRIGGER sync_user_trigger
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_to_public();

-- ==============================================
-- 2. FIX RLS POLICIES FOR ALL SORTING TABLES
-- ==============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view size class thresholds" ON size_class_thresholds;
DROP POLICY IF EXISTS "Admins can manage size class thresholds" ON size_class_thresholds;
DROP POLICY IF EXISTS "Allow all operations on size_class_thresholds" ON size_class_thresholds;
DROP POLICY IF EXISTS "Users can view sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Users can create sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Users can update their own sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Allow all operations on sorting_batches" ON sorting_batches;
DROP POLICY IF EXISTS "Users can view sorted fish items" ON sorted_fish_items;
DROP POLICY IF EXISTS "Users can create sorted fish items" ON sorted_fish_items;
DROP POLICY IF EXISTS "Allow all operations on sorted_fish_items" ON sorted_fish_items;
DROP POLICY IF EXISTS "Users can view sorting results" ON sorting_results;
DROP POLICY IF EXISTS "Allow all operations on sorting_results" ON sorting_results;

-- Create comprehensive RLS policies
CREATE POLICY "Allow all operations on size_class_thresholds" ON size_class_thresholds
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on sorting_batches" ON sorting_batches
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on sorted_fish_items" ON sorted_fish_items
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on sorting_results" ON sorting_results
    FOR ALL USING (true) WITH CHECK (true);

-- ==============================================
-- 3. GRANT PERMISSIONS TO ALL ROLES
-- ==============================================

-- Grant permissions to authenticated users
GRANT ALL ON size_class_thresholds TO authenticated;
GRANT ALL ON sorting_batches TO authenticated;
GRANT ALL ON sorted_fish_items TO authenticated;
GRANT ALL ON sorting_results TO authenticated;
GRANT ALL ON public.users TO authenticated;

-- Grant permissions to anon users (for testing)
GRANT ALL ON size_class_thresholds TO anon;
GRANT ALL ON sorting_batches TO anon;
GRANT ALL ON sorted_fish_items TO anon;
GRANT ALL ON sorting_results TO anon;
GRANT ALL ON public.users TO anon;

-- Grant permissions to service_role
GRANT ALL ON size_class_thresholds TO service_role;
GRANT ALL ON sorting_batches TO service_role;
GRANT ALL ON sorted_fish_items TO service_role;
GRANT ALL ON sorting_results TO service_role;
GRANT ALL ON public.users TO service_role;

-- ==============================================
-- 4. FIX AMBIGUOUS COLUMN REFERENCE IN INVENTORY FUNCTION
-- ==============================================

-- The issue is in the get_inventory_summary_with_sorting function where 'size' is ambiguous
-- between inventory.size and inventory_entries.size. We need to qualify the column names.

CREATE OR REPLACE FUNCTION get_inventory_summary_with_sorting()
RETURNS TABLE(
    size INTEGER,
    current_stock INTEGER,
    total_added_from_sorting INTEGER,
    total_dispatched INTEGER,
    last_sorting_date TIMESTAMP WITH TIME ZONE,
    last_dispatch_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        i.size,
        i.quantity as current_stock,
        COALESCE(sorting_adds.total_added, 0) as total_added_from_sorting,
        COALESCE(dispatch_removes.total_dispatched, 0) as total_dispatched,
        sorting_adds.last_sorting_date,
        dispatch_removes.last_dispatch_date
    FROM inventory i
    LEFT JOIN (
        SELECT 
            ie.size,  -- Qualify with table alias
            SUM(ie.quantity_change) as total_added,
            MAX(ie.created_at) as last_sorting_date
        FROM inventory_entries ie
        WHERE ie.entry_type = 'sorting' AND ie.quantity_change > 0
        GROUP BY ie.size  -- Qualify with table alias
    ) sorting_adds ON i.size = sorting_adds.size
    LEFT JOIN (
        SELECT 
            ie.size,  -- Qualify with table alias
            ABS(SUM(ie.quantity_change)) as total_dispatched,
            MAX(ie.created_at) as last_dispatch_date
        FROM inventory_entries ie
        WHERE ie.entry_type = 'order_dispatch' AND ie.quantity_change < 0
        GROUP BY ie.size  -- Qualify with table alias
    ) dispatch_removes ON i.size = dispatch_removes.size
    ORDER BY i.size;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 5. CREATE MISSING INDEXES FOR PERFORMANCE
-- ==============================================

-- Create indexes for the public.users table
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active);

-- Create additional indexes for sorting tables
CREATE INDEX IF NOT EXISTS idx_sorting_batches_sorted_by ON sorting_batches(sorted_by);
CREATE INDEX IF NOT EXISTS idx_sorting_batches_created_at ON sorting_batches(created_at);

-- ==============================================
-- 6. ENABLE RLS ON PUBLIC.USERS TABLE
-- ==============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on public users" ON public.users
    FOR ALL USING (true) WITH CHECK (true);

-- ==============================================
-- 7. CREATE HELPER FUNCTIONS FOR FRONTEND
-- ==============================================

-- Function to get user details by ID
CREATE OR REPLACE FUNCTION get_user_by_id(user_id UUID)
RETURNS TABLE(
    id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    role TEXT,
    phone TEXT,
    is_active BOOLEAN,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.role,
        u.phone,
        u.is_active,
        u.last_login,
        u.created_at,
        u.updated_at
    FROM public.users u
    WHERE u.id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get all active users
CREATE OR REPLACE FUNCTION get_active_users()
RETURNS TABLE(
    id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    role TEXT,
    phone TEXT,
    last_login TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.role,
        u.phone,
        u.last_login
    FROM public.users u
    WHERE u.is_active = true
    ORDER BY u.first_name, u.last_name;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 8. ADD COMMENTS FOR DOCUMENTATION
-- ==============================================

COMMENT ON TABLE public.users IS 'Public users table that mirrors auth.users for frontend queries';
COMMENT ON FUNCTION sync_user_to_public() IS 'Syncs auth.users data to public.users table';
COMMENT ON FUNCTION get_user_by_id(UUID) IS 'Gets user details by ID from public.users';
COMMENT ON FUNCTION get_active_users() IS 'Gets all active users from public.users';

-- ==============================================
-- 9. INITIAL DATA SYNC
-- ==============================================

-- Sync existing auth.users to public.users
INSERT INTO public.users (id, email, first_name, last_name, role, phone, is_active, last_login, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'first_name', ''),
    COALESCE(au.raw_user_meta_data->>'last_name', ''),
    COALESCE(au.raw_user_meta_data->>'role', 'viewer'),
    COALESCE(au.raw_user_meta_data->>'phone', ''),
    COALESCE((au.raw_user_meta_data->>'is_active')::boolean, true),
    au.last_sign_in_at,
    au.created_at,
    au.updated_at
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

-- ==============================================
-- 10. VERIFICATION QUERIES
-- ==============================================

-- These queries can be run to verify the fix
-- SELECT 'Size class thresholds accessible' as test, COUNT(*) as count FROM size_class_thresholds;
-- SELECT 'Sorting batches accessible' as test, COUNT(*) as count FROM sorting_batches;
-- SELECT 'Public users accessible' as test, COUNT(*) as count FROM public.users;
-- SELECT 'Inventory summary function works' as test, COUNT(*) as count FROM get_inventory_summary_with_sorting();
