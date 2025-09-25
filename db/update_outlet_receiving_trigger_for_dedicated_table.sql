-- Update Outlet Receiving Trigger for Dedicated Table
-- This updates the trigger to use the new outlet_receiving_inventory table

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS trigger_update_inventory_on_receiving ON outlet_receiving;
DROP FUNCTION IF EXISTS update_inventory_on_receiving();

-- Create the new function that uses the dedicated outlet_receiving_inventory table
CREATE OR REPLACE FUNCTION update_inventory_on_receiving()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process when status changes to 'confirmed'
    IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
        
        -- Insert inventory entry into the dedicated outlet_receiving_inventory table
        INSERT INTO outlet_receiving_inventory (
            outlet_receiving_id,
            dispatch_id,
            outlet_order_id,
            fish_type,
            quantity,
            unit_weight,
            total_weight,
            size_distribution,
            quality_grade,
            condition,
            outlet_name,
            outlet_location,
            storage_location,
            received_date,
            entry_date,
            created_by,
            notes,
            discrepancy_notes
        )
        VALUES (
            NEW.id,
            NEW.dispatch_id,
            NEW.outlet_order_id,
            'Tilapia', -- Default fish type, can be enhanced later
            NEW.actual_pieces_received,
            CASE 
                WHEN NEW.actual_pieces_received > 0 
                THEN NEW.actual_weight_received / NEW.actual_pieces_received 
                ELSE 0 
            END,
            NEW.actual_weight_received,
            NEW.size_discrepancies,
            NEW.condition,
            NEW.condition,
            COALESCE(NEW.outlet_name, 'Unknown Outlet'),
            COALESCE(NEW.outlet_location, 'Unknown Location'),
            'Outlet Storage - ' || COALESCE(NEW.outlet_name, 'Unknown'),
            NEW.received_date,
            CURRENT_DATE,
            NEW.received_by,
            'Received at outlet - ' || COALESCE(NEW.outlet_name, 'Unknown'),
            NEW.discrepancy_notes
        );

        -- Log the inventory update (optional) - only if audit_logs table exists
        BEGIN
            INSERT INTO audit_logs (
                user_id,
                action,
                table_name,
                record_id,
                new_values,
                created_at
            )
            VALUES (
                NEW.received_by,
                'INSERT',
                'outlet_receiving_inventory',
                NEW.id,
                jsonb_build_object(
                    'outlet_name', NEW.outlet_name,
                    'total_weight', NEW.actual_weight_received,
                    'total_pieces', NEW.actual_pieces_received,
                    'status', 'confirmed'
                ),
                NOW()
            );
        EXCEPTION
            WHEN undefined_table THEN
                -- audit_logs table doesn't exist, skip logging
                NULL;
        END;

    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER trigger_update_inventory_on_receiving
    AFTER INSERT OR UPDATE ON outlet_receiving
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_on_receiving();

-- Create a function to get outlet receiving inventory summary
CREATE OR REPLACE FUNCTION get_outlet_receiving_inventory_summary(
    p_outlet_name TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    outlet_name TEXT,
    total_receiving_records BIGINT,
    total_weight_received DECIMAL(10,2),
    total_pieces_received BIGINT,
    average_unit_weight DECIMAL(10,2),
    last_received_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ori.outlet_name,
        COUNT(*) as total_receiving_records,
        SUM(ori.total_weight) as total_weight_received,
        SUM(ori.quantity) as total_pieces_received,
        CASE 
            WHEN SUM(ori.quantity) > 0 
            THEN SUM(ori.total_weight) / SUM(ori.quantity) 
            ELSE 0 
        END as average_unit_weight,
        MAX(ori.received_date) as last_received_date
    FROM outlet_receiving_inventory ori
    WHERE 
        (p_outlet_name IS NULL OR ori.outlet_name ILIKE '%' || p_outlet_name || '%')
        AND (p_start_date IS NULL OR ori.received_date >= p_start_date)
        AND (p_end_date IS NULL OR ori.received_date <= p_end_date)
    GROUP BY ori.outlet_name
    ORDER BY ori.outlet_name;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get detailed outlet receiving inventory
CREATE OR REPLACE FUNCTION get_outlet_receiving_inventory_details(
    p_outlet_receiving_id UUID DEFAULT NULL,
    p_outlet_name TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    outlet_receiving_id UUID,
    outlet_name TEXT,
    outlet_location TEXT,
    fish_type TEXT,
    quantity INTEGER,
    total_weight DECIMAL(10,2),
    unit_weight DECIMAL(10,2),
    quality_grade TEXT,
    condition condition_type,
    received_date DATE,
    notes TEXT,
    discrepancy_notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ori.id,
        ori.outlet_receiving_id,
        ori.outlet_name,
        ori.outlet_location,
        ori.fish_type,
        ori.quantity,
        ori.total_weight,
        ori.unit_weight,
        ori.quality_grade,
        ori.condition,
        ori.received_date,
        ori.notes,
        ori.discrepancy_notes
    FROM outlet_receiving_inventory ori
    WHERE 
        (p_outlet_receiving_id IS NULL OR ori.outlet_receiving_id = p_outlet_receiving_id)
        AND (p_outlet_name IS NULL OR ori.outlet_name ILIKE '%' || p_outlet_name || '%')
    ORDER BY ori.received_date DESC, ori.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions on the new functions
GRANT EXECUTE ON FUNCTION get_outlet_receiving_inventory_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_outlet_receiving_inventory_details TO authenticated;

-- Verify the trigger was created
SELECT 
    trigger_name, 
    event_manipulation, 
    action_timing, 
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_update_inventory_on_receiving';
