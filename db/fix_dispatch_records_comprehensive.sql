-- Comprehensive Fix for Dispatch Records Data
-- This script updates dispatch records with proper data from outlet orders
-- Run this in Supabase SQL Editor

-- First, let's see what we're working with
SELECT 
    'Current Dispatch Records Status' as info,
    COUNT(*) as total_records,
    COUNT(CASE WHEN total_weight = 0 THEN 1 END) as zero_weight_records,
    COUNT(CASE WHEN total_pieces = 0 THEN 1 END) as zero_pieces_records,
    COUNT(CASE WHEN outlet_order_id IS NOT NULL THEN 1 END) as records_with_orders
FROM dispatch_records;

-- Update dispatch records that have 0 weight/pieces but have outlet_order_id
-- Use size_quantities if available, otherwise fall back to requested_quantity
UPDATE dispatch_records 
SET 
    total_weight = COALESCE(
        (SELECT 
            CASE 
                WHEN oo.size_quantities IS NOT NULL AND jsonb_typeof(oo.size_quantities) = 'object' 
                THEN (
                    SELECT SUM(COALESCE((value::text)::numeric, 0))
                    FROM jsonb_each(oo.size_quantities)
                )
                ELSE COALESCE(oo.requested_quantity, 0)
            END
         FROM outlet_orders oo 
         WHERE oo.id = dispatch_records.outlet_order_id), 
        0
    ),
    total_pieces = COALESCE(
        (SELECT 
            CASE 
                WHEN oo.size_quantities IS NOT NULL AND jsonb_typeof(oo.size_quantities) = 'object' 
                THEN (
                    SELECT SUM(COALESCE((value::text)::numeric, 0))
                    FROM jsonb_each(oo.size_quantities)
                )
                ELSE COALESCE(oo.requested_quantity, 0)
            END
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
         WHERE oo.id = dispatch_records.outlet_order_id 
         AND oo.size_quantities IS NOT NULL 
         AND jsonb_typeof(oo.size_quantities) = 'object'), 
        dispatch_records.size_breakdown
    )
WHERE dispatch_records.total_weight = 0 
AND dispatch_records.total_pieces = 0 
AND dispatch_records.outlet_order_id IS NOT NULL;

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

-- Create a comprehensive view to show dispatch records with complete information
CREATE OR REPLACE VIEW dispatch_records_complete AS
SELECT 
    dr.*,
    oo.order_number,
    oo.requested_quantity as order_requested_quantity,
    oo.size_quantities as order_size_quantities,
    oo.total_value as order_total_value,
    oo.status as order_status,
    o.name as outlet_name,
    o.location as outlet_location,
    o.phone as outlet_phone,
    o.manager_name as outlet_manager
FROM dispatch_records dr
LEFT JOIN outlet_orders oo ON dr.outlet_order_id = oo.id
LEFT JOIN outlets o ON oo.outlet_id = o.id;

-- Grant permissions on the view
GRANT SELECT ON dispatch_records_complete TO authenticated;

-- Add comments
COMMENT ON VIEW dispatch_records_complete IS 'Complete dispatch records with outlet and order information including size quantities';

-- Verify the updates
SELECT 
    'After Update - Dispatch Records Status' as info,
    COUNT(*) as total_records,
    COUNT(CASE WHEN total_weight = 0 THEN 1 END) as zero_weight_records,
    COUNT(CASE WHEN total_pieces = 0 THEN 1 END) as zero_pieces_records,
    COUNT(CASE WHEN outlet_order_id IS NOT NULL THEN 1 END) as records_with_orders
FROM dispatch_records;

-- Show sample of updated records
SELECT 
    dr.id,
    dr.destination,
    dr.total_weight,
    dr.total_pieces,
    dr.total_value,
    dr.status,
    oo.order_number,
    oo.requested_quantity,
    oo.size_quantities,
    o.name as outlet_name
FROM dispatch_records dr
LEFT JOIN outlet_orders oo ON dr.outlet_order_id = oo.id
LEFT JOIN outlets o ON oo.outlet_id = o.id
ORDER BY dr.dispatch_date DESC
LIMIT 10;
