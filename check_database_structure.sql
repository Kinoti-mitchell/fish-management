-- Check Database Structure
-- This script verifies which tables we should be working with

-- 1. Check all tables in the database
SELECT 'All Tables in Database' as section;
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Check transfers table structure
SELECT 'Transfers Table Structure' as section;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'transfers' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check sorting_results table structure
SELECT 'Sorting Results Table Structure' as section;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sorting_results' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Check storage_locations table structure
SELECT 'Storage Locations Table Structure' as section;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'storage_locations' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Check if there are other inventory-related tables
SELECT 'Other Inventory Tables' as section;
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
AND (table_name LIKE '%inventory%' 
     OR table_name LIKE '%stock%' 
     OR table_name LIKE '%fish%'
     OR table_name LIKE '%batch%')
ORDER BY table_name;

-- 6. Check current data in key tables
SELECT 'Sample Data from Transfers Table' as section;
SELECT 
    id,
    from_storage_name,
    to_storage_name,
    size_class,
    weight_kg,
    status,
    created_at
FROM transfers
ORDER BY created_at DESC
LIMIT 5;

-- 7. Check sample data from sorting_results
SELECT 'Sample Data from Sorting Results Table' as section;
SELECT 
    sr.id,
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    sr.created_at
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
ORDER BY sr.created_at DESC
LIMIT 5;

-- 8. Check sample data from storage_locations
SELECT 'Sample Data from Storage Locations Table' as section;
SELECT 
    id,
    name,
    location_type,
    status
FROM storage_locations
ORDER BY name
LIMIT 10;
