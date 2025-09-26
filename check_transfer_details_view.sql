-- Check if transfer_details is a view and find the underlying table

-- 1. Check if transfer_details is a view
SELECT 'TRANSFER_DETAILS TYPE:' as info;
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'transfer_details' AND table_schema = 'public';

-- 2. If it's a view, get the view definition
SELECT 'TRANSFER_DETAILS VIEW DEFINITION:' as info;
SELECT definition 
FROM pg_views 
WHERE viewname = 'transfer_details' AND schemaname = 'public';

-- 3. Check what tables the view might be based on
SELECT 'ALL TRANSFER TABLES:' as info;
SELECT table_name, table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%transfer%'
ORDER BY table_name;

-- 4. Check if there's a base table we should use instead
SELECT 'CHECKING FOR BASE TRANSFER TABLE:' as info;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transfers' AND table_type = 'BASE TABLE') 
        THEN 'transfers table exists as BASE TABLE' 
        ELSE 'transfers table does not exist or is not a base table' 
    END as transfers_status;
