-- Debug Dispatch UUID Issue
-- This script helps identify why "Admin User" is being passed as a UUID
-- Run this in Supabase SQL Editor

-- Check all dispatch records and their IDs
SELECT 
    'All Dispatch Records' as info,
    id,
    destination,
    total_weight,
    total_pieces,
    status,
    dispatch_date
FROM dispatch_records
ORDER BY dispatch_date DESC;

-- Check if any dispatch records have "Admin User" as destination
SELECT 
    'Dispatch Records with Admin User' as info,
    id,
    destination,
    total_weight,
    total_pieces,
    status
FROM dispatch_records
WHERE destination = 'Admin User';

-- Check dispatch records with their outlet order details
SELECT 
    'Dispatch with Order Details' as info,
    dr.id as dispatch_id,
    dr.destination,
    dr.total_weight,
    dr.status,
    oo.id as order_id,
    oo.order_number,
    oo.requested_quantity,
    oo.total_value,
    o.name as outlet_name
FROM dispatch_records dr
LEFT JOIN outlet_orders oo ON dr.outlet_order_id = oo.id
LEFT JOIN outlets o ON oo.outlet_id = o.id
ORDER BY dr.dispatch_date DESC
LIMIT 10;

-- Check if there are any dispatch records without proper outlet_order_id
SELECT 
    'Dispatch Records without Order ID' as info,
    id,
    destination,
    outlet_order_id,
    total_weight,
    status
FROM dispatch_records
WHERE outlet_order_id IS NULL;
