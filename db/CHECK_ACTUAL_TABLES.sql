-- Check what tables actually exist in your database
-- Run this in your Supabase SQL editor to see what you have

-- 1. List all tables that contain 'transfer' in their name
SELECT 'Transfer-related tables:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%transfer%' 
ORDER BY table_name;

-- 2. Check if transfers table exists and show its structure
SELECT 'transfers table structure:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'transfers' 
ORDER BY ordinal_position;

-- 3. Count records in transfers table
SELECT 'transfers table record count:' as info;
SELECT COUNT(*) as total_records FROM transfers;

-- 4. Show sample records from transfers table
SELECT 'Sample transfer records:' as info;
SELECT id, from_storage_name, to_storage_name, size_class, status, created_at 
FROM transfers 
ORDER BY created_at DESC 
LIMIT 5;

-- 5. Check if create_batch_transfer function exists
SELECT 'create_batch_transfer function status:' as info;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'create_batch_transfer') 
        THEN 'EXISTS' 
        ELSE 'DOES NOT EXIST' 
    END as function_status;
