-- Check what columns actually exist in the transfers table

SELECT 'TRANSFERS TABLE COLUMNS:' as check_type;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'transfers' AND table_schema = 'public'
ORDER BY ordinal_position;
