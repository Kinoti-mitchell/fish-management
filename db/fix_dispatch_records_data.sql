-- Fix Dispatch Records Data
-- This script updates dispatch records with proper data from outlet orders
-- Run this in Supabase SQL Editor

-- Update dispatch records that have 0 weight/pieces but have outlet_order_id
UPDATE dispatch_records 
SET 
    total_weight = COALESCE(
        (SELECT SUM(COALESCE(oo.requested_quantity, 0)) 
         FROM outlet_orders oo 
         WHERE oo.id = dispatch_records.outlet_order_id), 
        0
    ),
    total_pieces = COALESCE(
        (SELECT SUM(COALESCE(oo.requested_quantity, 0)) 
         FROM outlet_orders oo 
         WHERE oo.id = dispatch_records.outlet_order_id), 
        0
    ),
    total_value = COALESCE(
        (SELECT oo.total_value 
         FROM outlet_orders oo 
         WHERE oo.id = dispatch_records.outlet_order_id), 
        dispatch_records.total_value
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

-- Create a view to show dispatch records with complete information
CREATE OR REPLACE VIEW dispatch_records_complete AS
SELECT 
    dr.*,
    oo.order_number,
    oo.total_value as order_total_value,
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
COMMENT ON VIEW dispatch_records_complete IS 'Complete dispatch records with outlet and order information';

-- Verify the updates
SELECT 
    dr.id,
    dr.destination,
    dr.total_weight,
    dr.total_pieces,
    dr.total_value,
    dr.status,
    oo.order_number,
    o.name as outlet_name
FROM dispatch_records dr
LEFT JOIN outlet_orders oo ON dr.outlet_order_id = oo.id
LEFT JOIN outlets o ON oo.outlet_id = o.id
ORDER BY dr.dispatch_date DESC
LIMIT 10;
