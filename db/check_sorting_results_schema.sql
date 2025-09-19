-- Check the actual schema of sorting_results table
-- This will help identify which columns exist

-- 1. Check table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sorting_results' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check if transfer-related columns exist
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'sorting_results' 
            AND column_name = 'transfer_source_storage_id'
        ) THEN 'EXISTS'
        ELSE 'MISSING'
    END as transfer_source_storage_id_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'sorting_results' 
            AND column_name = 'transfer_source_storage_name'
        ) THEN 'EXISTS'
        ELSE 'MISSING'
    END as transfer_source_storage_name_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'sorting_results' 
            AND column_name = 'transfer_id'
        ) THEN 'EXISTS'
        ELSE 'MISSING'
    END as transfer_id_status;

-- 3. Show sample data from sorting_results (if any exists)
SELECT 
    'Sample sorting_results data' as report_type,
    COUNT(*) as total_records
FROM sorting_results;

-- 4. Show first few records with available columns
SELECT *
FROM sorting_results
LIMIT 3;
