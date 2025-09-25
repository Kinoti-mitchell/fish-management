-- Check Dispatch Records Data
-- This script helps debug the dispatch records issue
-- Run this in Supabase SQL Editor

-- Check if dispatch_records table exists and has data
SELECT 
    'Dispatch Records Count' as info,
    COUNT(*) as total_records
FROM dispatch_records;

-- Check dispatch records with their IDs and status
SELECT 
    'Sample Dispatch Records' as info,
    id,
    outlet_order_id,
    destination,
    total_weight,
    total_pieces,
    total_value,
    status,
    dispatch_date
FROM dispatch_records
ORDER BY dispatch_date DESC
LIMIT 10;

-- Check if there are any dispatch records with invalid IDs
SELECT 
    'Invalid ID Check' as info,
    id,
    CASE 
        WHEN id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        THEN 'Valid UUID' 
        ELSE 'Invalid UUID' 
    END as id_status
FROM dispatch_records
WHERE id IS NOT NULL
LIMIT 10;

-- Check outlet_receiving table structure
SELECT 
    'Outlet Receiving Table Structure' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'outlet_receiving' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if outlet_receiving table has any data
SELECT 
    'Outlet Receiving Count' as info,
    COUNT(*) as total_records
FROM outlet_receiving;
