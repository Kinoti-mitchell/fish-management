-- Update Inventory on Order Dispatch
-- This function helps update the inventory system when orders are dispatched

-- Create function to update inventory when orders are dispatched
CREATE OR REPLACE FUNCTION update_inventory_on_dispatch(
    p_order_id UUID,
    p_size INTEGER,
    p_quantity INTEGER,
    p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    -- Insert inventory entry for the dispatch
    INSERT INTO inventory_entries (
        size,
        quantity_change,
        entry_type,
        reference_id,
        notes
    ) VALUES (
        p_size,
        -p_quantity, -- Negative for dispatch
        'order_dispatch',
        p_order_id,
        COALESCE(p_notes, 'Order dispatch - Order ID: ' || p_order_id)
    );
    
    -- Update or insert inventory record
    INSERT INTO inventory (
        size,
        quantity
    ) VALUES (
        p_size,
        -p_quantity
    )
    ON CONFLICT (size) 
    DO UPDATE SET 
        quantity = inventory.quantity - p_quantity,
        updated_at = NOW()
    WHERE inventory.quantity >= p_quantity; -- Only update if sufficient stock
    
    -- Return true if successful
    RETURN TRUE;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and return false
        RAISE WARNING 'Failed to update inventory for order %: %', p_order_id, SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Create function to check inventory availability before dispatch
CREATE OR REPLACE FUNCTION check_inventory_availability(
    p_size INTEGER,
    p_quantity INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    available_quantity INTEGER;
BEGIN
    -- Get current inventory for the size
    SELECT COALESCE(quantity, 0) INTO available_quantity
    FROM inventory
    WHERE size = p_size;
    
    -- Return true if sufficient stock available
    RETURN available_quantity >= p_quantity;
END;
$$ LANGUAGE plpgsql;

-- Create function to get inventory summary for orders
CREATE OR REPLACE FUNCTION get_inventory_summary_for_orders()
RETURNS TABLE (
    size INTEGER,
    total_quantity INTEGER,
    total_weight_kg DECIMAL(10,2),
    storage_locations JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.size,
        i.quantity as total_quantity,
        (i.quantity * 0.5) as total_weight_kg, -- Estimate 0.5kg per fish
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'storage_location_id', sl.id,
                    'storage_location_name', sl.name,
                    'quantity', COALESCE(sr.total_pieces, 0),
                    'weight_kg', COALESCE(sr.total_weight_grams / 1000.0, 0)
                )
            ) FILTER (WHERE sl.id IS NOT NULL),
            '[]'::jsonb
        ) as storage_locations
    FROM inventory i
    LEFT JOIN sorting_results sr ON sr.size_class = i.size
    LEFT JOIN storage_locations sl ON sl.id = sr.storage_location_id
    WHERE i.quantity > 0
    GROUP BY i.size, i.quantity
    ORDER BY i.size;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_inventory_on_dispatch(UUID, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_inventory_availability(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_summary_for_orders() TO authenticated;
