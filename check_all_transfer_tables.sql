-- Check ALL Transfer Tables and Functions
-- This will show you exactly what transfer-related tables and functions exist

-- 1. List ALL tables with 'transfer' in the name
SELECT 'ALL TRANSFER TABLES:' as check_type;
SELECT table_name, table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%transfer%'
ORDER BY table_name;

-- 2. Check transfers table structure (if it exists)
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

-- 3. Check transfer_requests table structure (if it exists)
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

-- 4. Check transfer_log table structure (if it exists)
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

-- 5. Check what transfer functions exist
SELECT 'TRANSFER FUNCTIONS:' as check_type;
SELECT routine_name, routine_type, data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%transfer%'
ORDER BY routine_name;

-- 6. Count records in each transfer table (only if they exist)
SELECT 'TRANSFER TABLE RECORD COUNTS:' as check_type;
DO $$
DECLARE
    table_exists boolean;
    record_count integer;
BEGIN
    -- Check transfers table
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transfers' AND table_schema = 'public') INTO table_exists;
    IF table_exists THEN
        EXECUTE 'SELECT COUNT(*) FROM transfers' INTO record_count;
        RAISE NOTICE 'transfers table: % records', record_count;
    ELSE
        RAISE NOTICE 'transfers table: DOES NOT EXIST';
    END IF;
    
    -- Check transfer_requests table
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transfer_requests' AND table_schema = 'public') INTO table_exists;
    IF table_exists THEN
        EXECUTE 'SELECT COUNT(*) FROM transfer_requests' INTO record_count;
        RAISE NOTICE 'transfer_requests table: % records', record_count;
    ELSE
        RAISE NOTICE 'transfer_requests table: DOES NOT EXIST';
    END IF;
    
    -- Check transfer_log table
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transfer_log' AND table_schema = 'public') INTO table_exists;
    IF table_exists THEN
        EXECUTE 'SELECT COUNT(*) FROM transfer_log' INTO record_count;
        RAISE NOTICE 'transfer_log table: % records', record_count;
    ELSE
        RAISE NOTICE 'transfer_log table: DOES NOT EXIST';
    END IF;
END $$;

-- 7. Check RLS policies on transfer tables
SELECT 'TRANSFER TABLE RLS POLICIES:' as check_type;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename LIKE '%transfer%'
ORDER BY tablename, policyname;

-- 8. Check RLS status on transfer tables
SELECT 'TRANSFER TABLE RLS STATUS:' as check_type;
SELECT schemaname, tablename, rowsecurity
FROM pg_tables 
WHERE tablename LIKE '%transfer%'
ORDER BY tablename;
