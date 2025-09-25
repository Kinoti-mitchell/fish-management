-- Simple Fix for Dispatch Records Data
-- This script directly uses the outlet order data that already exists
-- Run this in Supabase SQL Editor

-- First, let's see what we're working with
SELECT 
    'Current Status' as info,
    COUNT(*) as total_dispatch_records,
    COUNT(CASE WHEN total_weight = 0 THEN 1 END) as zero_weight_records,
    COUNT(CASE WHEN total_pieces = 0 THEN 1 END) as zero_pieces_records,
    COUNT(CASE WHEN outlet_order_id IS NOT NULL THEN 1 END) as records_with_orders
FROM dispatch_records;

-- Show sample of current data
SELECT 
    'Sample Current Data' as info,
    dr.id as dispatch_id,
    dr.total_weight,
    dr.total_pieces,
    dr.total_value,
    oo.requested_quantity,
    oo.size_quantities,
    oo.total_value as order_total_value
FROM dispatch_records dr
LEFT JOIN outlet_orders oo ON dr.outlet_order_id = oo.id
LIMIT 5;

-- Update dispatch records with data directly from outlet orders
UPDATE dispatch_records 
SET 
    total_weight = COALESCE(
        (SELECT oo.requested_quantity 
         FROM outlet_orders oo 
         WHERE oo.id = dispatch_records.outlet_order_id), 
        0
    ),
    total_pieces = COALESCE(
        (SELECT oo.requested_quantity 
         FROM outlet_orders oo 
         WHERE oo.id = dispatch_records.outlet_order_id), 
        0
    ),
    total_value = COALESCE(
        (SELECT oo.total_value 
         FROM outlet_orders oo 
         WHERE oo.id = dispatch_records.outlet_order_id), 
        dispatch_records.total_value
    ),
    size_breakdown = COALESCE(
        (SELECT oo.size_quantities 
         FROM outlet_orders oo 
         WHERE oo.id = dispatch_records.outlet_order_id), 
        dispatch_records.size_breakdown
    )
WHERE dispatch_records.outlet_order_id IS NOT NULL;

-- Update dispatch records with proper outlet information
UPDATE dispatch_records 
SET 
    destination = COALESCE(
        (SELECT o.name 
         FROM outlet_orders oo 
         JOIN outlets o ON o.id = oo.outlet_id 
         WHERE oo.id = dispatch_records.outlet_order_id), 
        dispatch_records.destination
    )
WHERE dispatch_records.outlet_order_id IS NOT NULL;

-- Verify the updates
SELECT 
    'After Update - Status' as info,
    COUNT(*) as total_dispatch_records,
    COUNT(CASE WHEN total_weight = 0 THEN 1 END) as zero_weight_records,
    COUNT(CASE WHEN total_pieces = 0 THEN 1 END) as zero_pieces_records,
    COUNT(CASE WHEN outlet_order_id IS NOT NULL THEN 1 END) as records_with_orders
FROM dispatch_records;

-- Show sample of updated data
SELECT 
    'Sample Updated Data' as info,
    dr.id as dispatch_id,
    dr.destination,
    dr.total_weight,
    dr.total_pieces,
    dr.total_value,
    dr.status,
    oo.order_number,
    oo.requested_quantity,
    oo.total_value as order_total_value,
    o.name as outlet_name
FROM dispatch_records dr
LEFT JOIN outlet_orders oo ON dr.outlet_order_id = oo.id
LEFT JOIN outlets o ON oo.outlet_id = o.id
ORDER BY dr.dispatch_date DESC
LIMIT 10;
