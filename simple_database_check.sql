-- Simple Database Check - Safe Version
-- This will only check what exists without causing errors

-- 1. Check what transfer tables exist
SELECT 'EXISTING TRANSFER TABLES:' as check_type;
SELECT table_name, table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%transfer%'
ORDER BY table_name;

-- 2. Check transfers table structure (if it exists)
SELECT 'TRANSFERS TABLE STRUCTURE (if exists):' as check_type;
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'transfers'
ORDER BY ordinal_position;

-- 3. Check what transfer functions exist
SELECT 'EXISTING TRANSFER FUNCTIONS:' as check_type;
SELECT routine_name, routine_type, data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%transfer%'
ORDER BY routine_name;

-- 4. Check RLS status on transfer tables
SELECT 'TRANSFER TABLE RLS STATUS:' as check_type;
SELECT schemaname, tablename, rowsecurity, forcerowsecurity
FROM pg_tables 
WHERE tablename LIKE '%transfer%'
ORDER BY tablename;

-- 5. Check if transfers table has data (only if it exists)
SELECT 'TRANSFERS TABLE DATA COUNT (if exists):' as check_type;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transfers' AND table_schema = 'public')
        THEN (SELECT COUNT(*)::text FROM transfers)
        ELSE 'transfers table does not exist'
    END as transfers_count;
