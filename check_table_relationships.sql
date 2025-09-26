-- Check Table Relationships
-- This script verifies the relationships between tables

-- 1. Check foreign key relationships
SELECT 'Foreign Key Relationships' as section;
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
AND tc.table_name IN ('transfers', 'sorting_results', 'storage_locations')
ORDER BY tc.table_name, kcu.column_name;

-- 2. Check if sorting_results has storage_location_id
SELECT 'Sorting Results Storage Location Check' as section;
SELECT 
    COUNT(*) as total_records,
    COUNT(storage_location_id) as records_with_storage_id,
    COUNT(*) - COUNT(storage_location_id) as records_without_storage_id
FROM sorting_results;

-- 3. Check if storage_location_id values exist in storage_locations
SELECT 'Storage Location ID Validation' as section;
SELECT 
    'Valid storage_location_id' as check_type,
    COUNT(*) as count
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id

UNION ALL

SELECT 
    'Invalid storage_location_id' as check_type,
    COUNT(*) as count
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.id IS NULL;

-- 4. Check transfers table foreign keys
SELECT 'Transfers Table Foreign Key Check' as section;
SELECT 
    COUNT(*) as total_transfers,
    COUNT(from_storage_location_id) as transfers_with_from_storage,
    COUNT(to_storage_location_id) as transfers_with_to_storage
FROM transfers;

-- 5. Check if transfer storage IDs exist in storage_locations
SELECT 'Transfer Storage Location Validation' as section;
SELECT 
    'Valid from_storage_location_id' as check_type,
    COUNT(*) as count
FROM transfers t
JOIN storage_locations sl ON t.from_storage_location_id = sl.id

UNION ALL

SELECT 
    'Invalid from_storage_location_id' as check_type,
    COUNT(*) as count
FROM transfers t
LEFT JOIN storage_locations sl ON t.from_storage_location_id = sl.id
WHERE sl.id IS NULL

UNION ALL

SELECT 
    'Valid to_storage_location_id' as check_type,
    COUNT(*) as count
FROM transfers t
JOIN storage_locations sl ON t.to_storage_location_id = sl.id

UNION ALL

SELECT 
    'Invalid to_storage_location_id' as check_type,
    COUNT(*) as count
FROM transfers t
LEFT JOIN storage_locations sl ON t.to_storage_location_id = sl.id
WHERE sl.id IS NULL;
