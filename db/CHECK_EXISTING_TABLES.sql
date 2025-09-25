-- Check what transfer-related tables currently exist in the database

-- 1. Check all tables with 'transfer' in the name
SELECT table_name, table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%transfer%'
ORDER BY table_name;

-- 2. Check if transfers table exists and show its structure
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
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'transfer_log'
ORDER BY ordinal_position;

-- 5. Check what functions exist
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%transfer%'
ORDER BY routine_name;

-- 6. Check if there's any data in any transfer tables
SELECT 'transfers' as table_name, COUNT(*) as row_count FROM transfers
UNION ALL
SELECT 'transfer_requests' as table_name, COUNT(*) as row_count FROM transfer_requests
UNION ALL
SELECT 'transfer_log' as table_name, COUNT(*) as row_count FROM transfer_log;
