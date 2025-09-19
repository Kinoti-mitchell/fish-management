-- Outlet Receiving Inventory Integration
-- Functions to update inventory when outlet receiving is recorded

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
        SELECT 
            'outlet_receiving' as entry_type,
            NEW.id as reference_id,
            'outlet_receiving' as reference_type,
            'Tilapia' as fish_type, -- Default fish type, can be enhanced later
            NEW.actual_pieces_received as quantity,
            CASE 
                WHEN NEW.actual_pieces_received > 0 
                THEN NEW.actual_weight_received / NEW.actual_pieces_received 
                ELSE 0 
            END as unit_weight,
            NEW.actual_weight_received as total_weight,
            NEW.size_discrepancies as size_distribution,
            'Outlet - ' || NEW.outlet_name as storage_location,
            NEW.condition as quality_grade,
            NEW.received_date as entry_date,
            COALESCE(NEW.discrepancy_notes, 'Received at outlet') as notes,
            NEW.received_by as created_by
        WHERE NEW.actual_weight_received > 0;

        -- Log the inventory update
        INSERT INTO audit_logs (
            user_id,
            action,
            table_name,
            record_id,
            new_values,
            created_at
        ) VALUES (
            NULL, -- No specific user for system actions
            'inventory_updated_on_receiving',
            'inventory_entries',
            NEW.id,
            jsonb_build_object(
                'receiving_id', NEW.id,
                'weight_received', NEW.actual_weight_received,
                'pieces_received', NEW.actual_pieces_received,
                'outlet', NEW.outlet_name
            ),
            NOW()
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

-- Function to get receiving summary for inventory tracking
CREATE OR REPLACE FUNCTION get_receiving_inventory_summary(
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    outlet_name TEXT,
    total_weight_received DECIMAL(10,2),
    total_pieces_received INTEGER,
    total_value_received DECIMAL(12,2),
    receiving_count INTEGER,
    avg_condition TEXT,
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
        CASE 
            WHEN AVG(CASE or_table.condition 
                WHEN 'excellent' THEN 4
                WHEN 'good' THEN 3
                WHEN 'fair' THEN 2
                WHEN 'poor' THEN 1
                ELSE 0 END) >= 3.5 THEN 'excellent'
            WHEN AVG(CASE or_table.condition 
                WHEN 'excellent' THEN 4
                WHEN 'good' THEN 3
                WHEN 'fair' THEN 2
                WHEN 'poor' THEN 1
                ELSE 0 END) >= 2.5 THEN 'good'
            WHEN AVG(CASE or_table.condition 
                WHEN 'excellent' THEN 4
                WHEN 'good' THEN 3
                WHEN 'fair' THEN 2
                WHEN 'poor' THEN 1
                ELSE 0 END) >= 1.5 THEN 'fair'
            ELSE 'poor'
        END as avg_condition,
        MAX(or_table.received_date) as last_received_date
    FROM outlet_receiving or_table
    WHERE or_table.status = 'confirmed'
    AND (start_date IS NULL OR or_table.received_date >= start_date)
    AND (end_date IS NULL OR or_table.received_date <= end_date)
    GROUP BY or_table.outlet_name
    ORDER BY total_weight_received DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to check receiving discrepancies
CREATE OR REPLACE FUNCTION get_receiving_discrepancies(
    threshold_percentage DECIMAL DEFAULT 5.0
)
RETURNS TABLE (
    receiving_id UUID,
    outlet_name TEXT,
    weight_discrepancy_percentage DECIMAL(5,2),
    pieces_discrepancy_percentage DECIMAL(5,2),
    value_discrepancy_percentage DECIMAL(5,2),
    has_size_discrepancies BOOLEAN,
    received_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        or_table.id as receiving_id,
        or_table.outlet_name,
        CASE 
            WHEN or_table.expected_weight > 0 
            THEN ((or_table.actual_weight_received - or_table.expected_weight) / or_table.expected_weight * 100)
            ELSE 0 
        END as weight_discrepancy_percentage,
        CASE 
            WHEN or_table.expected_pieces > 0 
            THEN ((or_table.actual_pieces_received - or_table.expected_pieces)::DECIMAL / or_table.expected_pieces * 100)
            ELSE 0 
        END as pieces_discrepancy_percentage,
        CASE 
            WHEN or_table.expected_value > 0 
            THEN ((or_table.actual_value_received - or_table.expected_value) / or_table.expected_value * 100)
            ELSE 0 
        END as value_discrepancy_percentage,
        (or_table.size_discrepancies IS NOT NULL AND jsonb_typeof(or_table.size_discrepancies) = 'object' AND jsonb_object_keys(or_table.size_discrepancies) IS NOT NULL) as has_size_discrepancies,
        or_table.received_date
    FROM outlet_receiving or_table
    WHERE or_table.status = 'confirmed'
    AND (
        ABS(CASE 
            WHEN or_table.expected_weight > 0 
            THEN ((or_table.actual_weight_received - or_table.expected_weight) / or_table.expected_weight * 100)
            ELSE 0 
        END) > threshold_percentage
        OR
        ABS(CASE 
            WHEN or_table.expected_pieces > 0 
            THEN ((or_table.actual_pieces_received - or_table.expected_pieces)::DECIMAL / or_table.expected_pieces * 100)
            ELSE 0 
        END) > threshold_percentage
        OR
        ABS(CASE 
            WHEN or_table.expected_value > 0 
            THEN ((or_table.actual_value_received - or_table.expected_value) / or_table.expected_value * 100)
            ELSE 0 
        END) > threshold_percentage
        OR
        (or_table.size_discrepancies IS NOT NULL AND jsonb_typeof(or_table.size_discrepancies) = 'object' AND jsonb_object_keys(or_table.size_discrepancies) IS NOT NULL)
    )
    ORDER BY ABS(CASE 
        WHEN or_table.expected_weight > 0 
        THEN ((or_table.actual_weight_received - or_table.expected_weight) / or_table.expected_weight * 100)
        ELSE 0 
    END) DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_inventory_on_receiving() TO authenticated;
GRANT EXECUTE ON FUNCTION get_receiving_inventory_summary(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_receiving_discrepancies(DECIMAL) TO authenticated;

-- Add comments
COMMENT ON FUNCTION update_inventory_on_receiving() IS 'Automatically updates inventory when outlet receiving is confirmed';
COMMENT ON FUNCTION get_receiving_inventory_summary(DATE, DATE) IS 'Returns summary of receiving data for inventory tracking';
COMMENT ON FUNCTION get_receiving_discrepancies(DECIMAL) IS 'Identifies receiving records with significant discrepancies';
