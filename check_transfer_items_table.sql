-- Check the transfer_items table structure and relationship

-- 1. Check transfer_items table structure
SELECT 'TRANSFER_ITEMS TABLE STRUCTURE:' as check_type;
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'transfer_items'
ORDER BY ordinal_position;

-- 2. Check transfers table structure
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

-- 3. Check foreign key relationships
SELECT 'FOREIGN KEY RELATIONSHIPS:' as check_type;
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND (tc.table_name = 'transfers' OR tc.table_name = 'transfer_items')
ORDER BY tc.table_name, kcu.column_name;

-- 4. Count records in both tables
SELECT 'RECORD COUNTS:' as check_type;
SELECT 'transfers' as table_name, COUNT(*) as record_count FROM transfers
UNION ALL
SELECT 'transfer_items' as table_name, COUNT(*) as record_count FROM transfer_items;

-- 5. Sample data from both tables
SELECT 'SAMPLE TRANSFERS DATA:' as check_type;
SELECT id, from_storage_location_id, to_storage_location_id, size_class, quantity, status, created_at
FROM transfers 
ORDER BY created_at DESC 
LIMIT 3;

SELECT 'SAMPLE TRANSFER_ITEMS DATA:' as check_type;
SELECT *
FROM transfer_items 
ORDER BY created_at DESC 
LIMIT 3;
