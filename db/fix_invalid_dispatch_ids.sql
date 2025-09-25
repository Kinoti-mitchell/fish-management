-- Fix Invalid Dispatch IDs
-- This script checks for and fixes dispatch records with invalid IDs
-- Run this in Supabase SQL Editor

-- First, let's see what we have
SELECT 
    'Current Dispatch Records' as info,
    id,
    destination,
    total_weight,
    total_pieces,
    status
FROM dispatch_records
ORDER BY dispatch_date DESC
LIMIT 10;

-- Check if there are any dispatch records with problematic data
SELECT 
    'Problematic Dispatch Records' as info,
    id,
    destination,
    total_weight,
    total_pieces,
    status,
    CASE 
        WHEN destination = 'Admin User' THEN 'PROBLEM: destination is Admin User'
        WHEN total_weight = 0 AND total_pieces = 0 THEN 'PROBLEM: zero values'
        ELSE 'OK'
    END as issue
FROM dispatch_records
WHERE destination = 'Admin User' 
   OR (total_weight = 0 AND total_pieces = 0)
ORDER BY dispatch_date DESC;

-- If you find dispatch records with 'Admin User' as destination, update them
-- UPDATE dispatch_records 
-- SET destination = 'Unknown Outlet'
-- WHERE destination = 'Admin User';

-- Check outlet_orders to see if they have proper data
SELECT 
    'Outlet Orders Sample' as info,
    id,
    order_number,
    requested_quantity,
    total_value,
    status,
    outlet_id
FROM outlet_orders
ORDER BY order_date DESC
LIMIT 10;

-- Check if there are any outlet orders that might be causing issues
SELECT 
    'Outlet Orders with Issues' as info,
    id,
    order_number,
    requested_quantity,
    total_value,
    status,
    outlet_id
FROM outlet_orders
WHERE requested_quantity IS NULL 
   OR requested_quantity = 0
   OR total_value IS NULL
   OR total_value = 0
ORDER BY order_date DESC;
