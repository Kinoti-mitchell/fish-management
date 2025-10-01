-- Fix Data Types - Run this in Supabase SQL Editor
-- This script fixes the data type issues that are causing the decimal insertion errors

-- 1. Fix dispatch_records table
-- Change total_pieces from integer to decimal
ALTER TABLE dispatch_records 
ALTER COLUMN total_pieces TYPE DECIMAL(10,2);

-- 2. Fix outlet_receiving table  
-- Change expected_pieces from integer to decimal
ALTER TABLE outlet_receiving 
ALTER COLUMN expected_pieces TYPE DECIMAL(10,2);

-- Change actual_pieces_received from integer to decimal
ALTER TABLE outlet_receiving 
ALTER COLUMN actual_pieces_received TYPE DECIMAL(10,2);

-- 3. Fix outlet_orders table
-- Change requested_quantity from integer to decimal
ALTER TABLE outlet_orders 
ALTER COLUMN requested_quantity TYPE DECIMAL(10,2);

-- 4. Verify the changes
SELECT 
    'dispatch_records' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'dispatch_records' 
AND column_name IN ('total_pieces', 'total_weight', 'total_value')
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 
    'outlet_receiving' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'outlet_receiving' 
AND column_name IN ('expected_pieces', 'actual_pieces_received', 'expected_weight', 'actual_weight_received')
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 
    'outlet_orders' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'outlet_orders' 
AND column_name IN ('requested_quantity', 'total_value')
AND table_schema = 'public'
ORDER BY ordinal_position;

