-- Check the actual structure and data in the transfers table
-- This will help us understand what columns exist and what data is available

-- 1. Check table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'transfers' 
ORDER BY ordinal_position;

-- 2. Check if there are any rows in the table
SELECT COUNT(*) as total_rows FROM transfers;

-- 3. If there are rows, show a sample to see what columns actually contain data
SELECT * FROM transfers LIMIT 3;

-- 4. Check if there are any columns that might contain size information
SELECT 
    column_name
FROM information_schema.columns 
WHERE table_name = 'transfers' 
AND (column_name LIKE '%size%' OR column_name LIKE '%class%' OR column_name LIKE '%type%');
