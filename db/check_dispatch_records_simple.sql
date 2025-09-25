-- Simple Check for Dispatch Records Data
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

-- Check if there are any dispatch records that might be causing issues
SELECT 
    'Dispatch Records with Zero Values' as info,
    id,
    outlet_order_id,
    destination,
    total_weight,
    total_pieces,
    total_value,
    status
FROM dispatch_records
WHERE total_weight = 0 OR total_pieces = 0
ORDER BY dispatch_date DESC
LIMIT 10;

-- Check dispatch records with their associated outlet orders
SELECT 
    'Dispatch with Order Details' as info,
    dr.id as dispatch_id,
    dr.destination,
    dr.total_weight,
    dr.total_pieces,
    dr.status,
    oo.id as order_id,
    oo.order_number,
    oo.requested_quantity,
    oo.total_value as order_value,
    o.name as outlet_name
FROM dispatch_records dr
LEFT JOIN outlet_orders oo ON dr.outlet_order_id = oo.id
LEFT JOIN outlets o ON oo.outlet_id = o.id
ORDER BY dr.dispatch_date DESC
LIMIT 10;
