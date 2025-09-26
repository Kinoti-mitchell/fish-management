-- Analyze all transfer tables to see what can be merged

-- 1. Check structure of all three tables
SELECT 'TRANSFERS TABLE STRUCTURE:' as table_name;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'transfers' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'TRANSFER_ITEMS TABLE STRUCTURE:' as table_name;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'transfer_items' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'TRANSFER_DETAILS TABLE STRUCTURE:' as table_name;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'transfer_details' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Count records in each table
SELECT 'RECORD COUNTS:' as info;
SELECT 'transfers' as table_name, COUNT(*) as record_count FROM transfers
UNION ALL
SELECT 'transfer_items' as table_name, COUNT(*) as record_count FROM transfer_items
UNION ALL
SELECT 'transfer_details' as table_name, COUNT(*) as record_count FROM transfer_details;

-- 3. Sample data from each table (first 2 records)
SELECT 'SAMPLE TRANSFERS DATA:' as info;
SELECT * FROM transfers LIMIT 2;

SELECT 'SAMPLE TRANSFER_ITEMS DATA:' as info;
SELECT * FROM transfer_items LIMIT 2;

SELECT 'SAMPLE TRANSFER_DETAILS DATA:' as info;
SELECT * FROM transfer_details LIMIT 2;

-- 4. Check foreign key relationships
SELECT 'FOREIGN KEY RELATIONSHIPS:' as info;
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
AND tc.table_name IN ('transfers', 'transfer_items', 'transfer_details')
ORDER BY tc.table_name, kcu.column_name;
