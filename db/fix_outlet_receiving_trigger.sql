-- Fix Outlet Receiving Trigger - Add Missing Columns to inventory_entries
-- This adds the missing columns that the existing logic expects

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS trigger_update_inventory_on_receiving ON outlet_receiving;
DROP FUNCTION IF EXISTS update_inventory_on_receiving();

-- Create the function using the original logic with all expected columns
CREATE OR REPLACE FUNCTION update_inventory_on_receiving()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process when status changes to 'confirmed'
    IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
        
        -- Insert inventory entry for received items using the original logic
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

-- Create the trigger
CREATE TRIGGER trigger_update_inventory_on_receiving
    AFTER INSERT OR UPDATE ON outlet_receiving
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_on_receiving();

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_inventory_on_receiving() TO authenticated;

-- Add comment
COMMENT ON FUNCTION update_inventory_on_receiving() IS 'Updates inventory when outlet receiving is confirmed - fixed to match actual table schema';
