-- MANUAL FIX: Outlet Receiving Type Mismatch
-- Copy and paste this SQL into your Supabase SQL Editor to fix the type mismatch error
-- The issue is that the status column is VARCHAR(20) in the table but TEXT in the function

-- Step 1: Drop the existing function
DROP FUNCTION IF EXISTS get_outlet_receiving_records();

-- Step 2: Create the corrected function with proper types
CREATE OR REPLACE FUNCTION get_outlet_receiving_records()
RETURNS TABLE (
    id UUID,
    dispatch_id UUID,
    outlet_order_id UUID,
    received_date DATE,
    received_by UUID,
    expected_weight DECIMAL(10,2),
    actual_weight_received DECIMAL(10,2),
    expected_pieces INTEGER,
    actual_pieces_received INTEGER,
    expected_value DECIMAL(10,2),
    actual_value_received DECIMAL(10,2),
    condition condition_type,
    size_discrepancies JSONB,
    discrepancy_notes TEXT,
    status VARCHAR(20),  -- FIXED: Changed from TEXT to VARCHAR(20) to match table schema
    outlet_name TEXT,
    outlet_location TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    dispatch_destination TEXT,
    dispatch_date DATE,
    order_number TEXT,
    outlet_name_from_order TEXT,
    outlet_location_from_order TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        outlet_rec.id,
        outlet_rec.dispatch_id,
        outlet_rec.outlet_order_id,
        outlet_rec.received_date,
        outlet_rec.received_by,
        outlet_rec.expected_weight,
        outlet_rec.actual_weight_received,
        outlet_rec.expected_pieces,
        outlet_rec.actual_pieces_received,
        outlet_rec.expected_value,
        outlet_rec.actual_value_received,
        outlet_rec.condition,
        outlet_rec.size_discrepancies,
        outlet_rec.discrepancy_notes,
        outlet_rec.status,
        outlet_rec.outlet_name,
        outlet_rec.outlet_location,
        outlet_rec.created_at,
        outlet_rec.updated_at,
        dr.destination as dispatch_destination,
        dr.dispatch_date,
        oo.order_number,
        outlet.name as outlet_name_from_order,
        outlet.location as outlet_location_from_order
    FROM outlet_receiving outlet_rec
    LEFT JOIN dispatch_records dr ON outlet_rec.dispatch_id = dr.id
    LEFT JOIN outlet_orders oo ON outlet_rec.outlet_order_id = oo.id
    LEFT JOIN outlets outlet ON oo.outlet_id = outlet.id
    ORDER BY outlet_rec.received_date DESC, outlet_rec.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION get_outlet_receiving_records TO authenticated;

-- Step 4: Test the function
SELECT 'get_outlet_receiving_records function created successfully' as status;

-- Step 5: Verify the fix by testing the function
-- This should now work without the type mismatch error
SELECT * FROM get_outlet_receiving_records() LIMIT 5;
