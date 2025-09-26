-- Check Current Database State
-- Run this to see what tables and functions currently exist

-- 1. Check all tables with 'transfer' in the name
SELECT 'TRANSFER TABLES:' as check_type;
SELECT table_name, table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%transfer%'
ORDER BY table_name;

-- 2. Check if transfers table exists and show its structure
SELECT 'TRANSFERS TABLE STRUCTURE:' as check_type;
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'transfers'
ORDER BY ordinal_position;

-- 3. Check if transfer_requests table exists
SELECT 'TRANSFER_REQUESTS TABLE STRUCTURE:' as check_type;
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'transfer_requests'
ORDER BY ordinal_position;

-- 4. Check if transfer_log table exists
SELECT 'TRANSFER_LOG TABLE STRUCTURE:' as check_type;
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'transfer_log'
ORDER BY ordinal_position;

-- 5. Check what transfer-related functions exist
SELECT 'TRANSFER FUNCTIONS:' as check_type;
SELECT routine_name, routine_type, data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%transfer%'
ORDER BY routine_name;

-- 6. Check if there's any data in any transfer tables
SELECT 'TRANSFER TABLE DATA COUNTS:' as check_type;
-- Only check tables that exist
DO $$
DECLARE
    table_exists boolean;
    result_text text := '';
BEGIN
    -- Check transfers table
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'transfers'
    ) INTO table_exists;
    
    IF table_exists THEN
        EXECUTE 'SELECT ''transfers'' as table_name, COUNT(*) as row_count FROM transfers' INTO result_text;
        RAISE NOTICE '%', result_text;
    ELSE
        RAISE NOTICE 'transfers table does not exist';
    END IF;
    
    -- Check transfer_requests table
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'transfer_requests'
    ) INTO table_exists;
    
    IF table_exists THEN
        EXECUTE 'SELECT ''transfer_requests'' as table_name, COUNT(*) as row_count FROM transfer_requests' INTO result_text;
        RAISE NOTICE '%', result_text;
    ELSE
        RAISE NOTICE 'transfer_requests table does not exist';
    END IF;
    
    -- Check transfer_log table
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'transfer_log'
    ) INTO table_exists;
    
    IF table_exists THEN
        EXECUTE 'SELECT ''transfer_log'' as table_name, COUNT(*) as row_count FROM transfer_log' INTO result_text;
        RAISE NOTICE '%', result_text;
    ELSE
        RAISE NOTICE 'transfer_log table does not exist';
    END IF;
END $$;

-- 7. Check RLS policies on transfer tables
SELECT 'TRANSFER TABLE RLS POLICIES:' as check_type;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename LIKE '%transfer%'
ORDER BY tablename, policyname;

-- 8. Check if transfers table has RLS enabled
SELECT 'TRANSFER TABLE RLS STATUS:' as check_type;
SELECT schemaname, tablename, rowsecurity, forcerowsecurity
FROM pg_tables 
WHERE tablename LIKE '%transfer%'
ORDER BY tablename;
