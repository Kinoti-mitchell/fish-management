-- Create RPC functions for outlet receiving operations
-- These functions will have SECURITY DEFINER to bypass RLS

-- Function to get outlet receiving records
CREATE OR REPLACE FUNCTION get_outlet_receiving_records_safe()
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
    expected_value DECIMAL(12,2),
    actual_value_received DECIMAL(12,2),
    condition condition_type,
    size_discrepancies JSONB,
    discrepancy_notes TEXT,
    status VARCHAR(20),
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
        dr.destination::TEXT as dispatch_destination,
        dr.dispatch_date,
        oo.order_number::TEXT as order_number,
        outlet.name::TEXT as outlet_name_from_order,
        outlet.location::TEXT as outlet_location_from_order
    FROM outlet_receiving outlet_rec
    LEFT JOIN dispatch_records dr ON outlet_rec.dispatch_id = dr.id
    LEFT JOIN outlet_orders oo ON outlet_rec.outlet_order_id = oo.id
    LEFT JOIN outlets outlet ON oo.outlet_id = outlet.id
    ORDER BY outlet_rec.received_date DESC, outlet_rec.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create outlet receiving record
CREATE OR REPLACE FUNCTION create_outlet_receiving_record_safe(
    p_dispatch_id UUID,
    p_outlet_order_id UUID,
    p_received_date DATE,
    p_received_by UUID,
    p_expected_weight DECIMAL(10,2),
    p_actual_weight_received DECIMAL(10,2),
    p_expected_pieces INTEGER,
    p_actual_pieces_received INTEGER,
    p_expected_value DECIMAL(12,2),
    p_actual_value_received DECIMAL(12,2),
    p_condition condition_type,
    p_size_discrepancies JSONB,
    p_discrepancy_notes TEXT,
    p_status VARCHAR(20),
    p_outlet_name TEXT,
    p_outlet_location TEXT
)
RETURNS UUID AS $$
DECLARE
    new_record_id UUID;
BEGIN
    -- Insert the receiving record
    INSERT INTO outlet_receiving (
        dispatch_id,
        outlet_order_id,
        received_date,
        received_by,
        expected_weight,
        actual_weight_received,
        expected_pieces,
        actual_pieces_received,
        expected_value,
        actual_value_received,
        condition,
        size_discrepancies,
        discrepancy_notes,
        status,
        outlet_name,
        outlet_location,
        created_at,
        updated_at
    ) VALUES (
        p_dispatch_id,
        p_outlet_order_id,
        p_received_date,
        p_received_by,
        p_expected_weight,
        p_actual_weight_received,
        p_expected_pieces,
        p_actual_pieces_received,
        p_expected_value,
        p_actual_value_received,
        p_condition,
        p_size_discrepancies,
        p_discrepancy_notes,
        p_status,
        p_outlet_name,
        p_outlet_location,
        NOW(),
        NOW()
    ) RETURNING id INTO new_record_id;
    
    -- Update dispatch status to delivered
    UPDATE dispatch_records 
    SET status = 'delivered', updated_at = NOW()
    WHERE id = p_dispatch_id;
    
    RETURN new_record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions on the functions
GRANT EXECUTE ON FUNCTION get_outlet_receiving_records_safe TO authenticated;
GRANT EXECUTE ON FUNCTION create_outlet_receiving_record_safe(
    UUID, UUID, DATE, UUID, DECIMAL(10,2), DECIMAL(10,2), INTEGER, INTEGER, 
    DECIMAL(12,2), DECIMAL(12,2), condition_type, JSONB, TEXT, VARCHAR(20), TEXT, TEXT
) TO authenticated;

-- Verify the functions were created
SELECT 'RPC functions created successfully' as status;
