-- Simplified Outlet Receiving Inventory Integration
-- Apply this SQL after the main enhancements

-- Function to update inventory when receiving is confirmed
CREATE OR REPLACE FUNCTION update_inventory_on_receiving()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process when status changes to 'confirmed'
    IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
        
        -- Insert inventory entry for received items
        INSERT INTO inventory_entries (
            entry_type,
            reference_id,
            reference_type,
            fish_type,
            quantity,
            unit_weight,
            total_weight,
            size_distribution,
            storage_location,
            quality_grade,
            entry_date,
            notes,
            created_by
        )
        VALUES (
            'outlet_receiving',
            NEW.id,
            'outlet_receiving',
            'Tilapia',
            NEW.actual_pieces_received,
            CASE 
                WHEN NEW.actual_pieces_received > 0 
                THEN NEW.actual_weight_received / NEW.actual_pieces_received 
                ELSE 0 
            END,
            NEW.actual_weight_received,
            NEW.size_discrepancies,
            'Outlet - ' || COALESCE(NEW.outlet_name, 'Unknown'),
            NEW.condition,
            NEW.received_date,
            COALESCE(NEW.discrepancy_notes, 'Received at outlet'),
            NEW.received_by
        );

    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for outlet receiving
DROP TRIGGER IF EXISTS trigger_update_inventory_on_receiving ON outlet_receiving;
CREATE TRIGGER trigger_update_inventory_on_receiving
    AFTER INSERT OR UPDATE ON outlet_receiving
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_on_receiving();

-- Simple function to get receiving summary
CREATE OR REPLACE FUNCTION get_receiving_summary()
RETURNS TABLE (
    outlet_name TEXT,
    total_weight_received DECIMAL(10,2),
    total_pieces_received INTEGER,
    total_value_received DECIMAL(12,2),
    receiving_count INTEGER,
    last_received_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        or_table.outlet_name,
        SUM(or_table.actual_weight_received) as total_weight_received,
        SUM(or_table.actual_pieces_received) as total_pieces_received,
        SUM(or_table.actual_value_received) as total_value_received,
        COUNT(*) as receiving_count,
        MAX(or_table.received_date) as last_received_date
    FROM outlet_receiving or_table
    WHERE or_table.status = 'confirmed'
    GROUP BY or_table.outlet_name
    ORDER BY total_weight_received DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_inventory_on_receiving() TO authenticated;
GRANT EXECUTE ON FUNCTION get_receiving_summary() TO authenticated;

-- Add comments
COMMENT ON FUNCTION update_inventory_on_receiving() IS 'Automatically updates inventory when outlet receiving is confirmed';
COMMENT ON FUNCTION get_receiving_summary() IS 'Returns summary of receiving data by outlet';
