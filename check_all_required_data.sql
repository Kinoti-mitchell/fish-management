-- Check if the deployed application has ALL necessary data and tables

-- 1. Check core tables that the application needs
SELECT 'CORE TABLES CHECK:' as check_type;
SELECT 
    table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t.table_name AND table_schema = 'public') 
        THEN 'EXISTS' 
        ELSE 'MISSING' 
    END as status
FROM (VALUES 
    ('transfers'),
    ('storage_locations'),
    ('sorting_results'),
    ('profiles'),
    ('sorting_batches')
) AS t(table_name);

-- 2. Check if transfers table has all required columns
SELECT 'TRANSFERS TABLE COLUMNS:' as check_type;
SELECT 
    column_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfers' AND column_name = c.column_name) 
        THEN 'EXISTS' 
        ELSE 'MISSING' 
    END as status
FROM (VALUES 
    ('id'),
    ('from_storage_location_id'),
    ('to_storage_location_id'),
    ('size_class'),
    ('quantity'),
    ('weight_kg'),
    ('notes'),
    ('status'),
    ('requested_by'),
    ('approved_by'),
    ('created_at'),
    ('updated_at')
) AS c(column_name);

-- 3. Check if required functions exist
SELECT 'REQUIRED FUNCTIONS:' as check_type;
SELECT 
    routine_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = f.routine_name) 
        THEN 'EXISTS' 
        ELSE 'MISSING' 
    END as status
FROM (VALUES 
    ('create_batch_transfer'),
    ('approve_transfer'),
    ('decline_transfer')
) AS f(routine_name);

-- 4. Check data counts in key tables
SELECT 'DATA COUNTS:' as check_type;
SELECT 'storage_locations' as table_name, COUNT(*) as count FROM storage_locations
UNION ALL
SELECT 'profiles' as table_name, COUNT(*) as count FROM profiles
UNION ALL
SELECT 'sorting_batches' as table_name, COUNT(*) as count FROM sorting_batches
UNION ALL
SELECT 'sorting_results' as table_name, COUNT(*) as count FROM sorting_results
UNION ALL
SELECT 'transfers' as table_name, COUNT(*) as count FROM transfers;

-- 5. Check if there are any active storage locations
SELECT 'ACTIVE STORAGE LOCATIONS:' as check_type;
SELECT COUNT(*) as active_storage_count FROM storage_locations WHERE status = 'active';

-- 6. Check if there are any users/profiles
SELECT 'USER PROFILES:' as check_type;
SELECT COUNT(*) as user_count FROM profiles;

-- 7. Check if there's any inventory data (sorting_results)
SELECT 'INVENTORY DATA:' as check_type;
SELECT COUNT(*) as inventory_records FROM sorting_results;

-- 8. Check RLS status on key tables
SELECT 'RLS STATUS:' as check_type;
SELECT tablename, rowsecurity
FROM pg_tables 
WHERE tablename IN ('transfers', 'storage_locations', 'profiles', 'sorting_results', 'sorting_batches')
ORDER BY tablename;
