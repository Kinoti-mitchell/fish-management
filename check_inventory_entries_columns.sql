-- Check inventory_entries table structure
-- Run this in Supabase SQL Editor to see what columns actually exist

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'inventory_entries' 
AND table_schema = 'public'
ORDER BY ordinal_position;

