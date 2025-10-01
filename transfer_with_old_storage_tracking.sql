-- Transfer with Old Storage Location Tracking
-- This keeps track of where inventory was moved from

-- First, let's add a column to track old storage location if it doesn't exist
ALTER TABLE sorting_results ADD COLUMN IF NOT EXISTS previous_storage_location_id UUID;
ALTER TABLE sorting_results ADD COLUMN IF NOT EXISTS transfer_history JSONB DEFAULT '[]';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_sorting_results_previous_storage ON sorting_results(previous_storage_location_id);

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS approve_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS decline_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS approve_batch_transfer(UUID, UUID);

-- Create approve_transfer function that tracks old storage location
CREATE OR REPLACE FUNCTION approve_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transfer RECORD;
    v_source_inventory RECORD;
    v_transfer_history JSONB;
BEGIN
    -- Get the transfer record
    SELECT * INTO v_transfer
    FROM transfers
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT;
        RETURN;
    END IF;
    
    -- Check if source inventory exists and has sufficient quantity
    SELECT * INTO v_source_inventory
    FROM sorting_results
    WHERE storage_location_id = v_transfer.from_storage_location_id
    AND size_class = v_transfer.size_class
    AND total_pieces >= v_transfer.quantity;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Insufficient inventory in source storage'::TEXT;
        RETURN;
    END IF;
    
    -- Update transfer status to approved
    UPDATE transfers
    SET 
        status = 'approved',
        approved_by = p_approved_by,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id;
    
    -- Update inventory with old storage location tracking
    UPDATE sorting_results
    SET 
        previous_storage_location_id = storage_location_id,  -- Keep old location
        storage_location_id = v_transfer.to_storage_location_id,  -- Set new location
        transfer_history = COALESCE(transfer_history, '[]'::jsonb) || 
            jsonb_build_object(
                'transfer_id', p_transfer_id,
                'from_storage', storage_location_id,
                'to_storage', v_transfer.to_storage_location_id,
                'transferred_at', NOW(),
                'transferred_by', p_approved_by,
                'quantity', v_transfer.quantity,
                'weight_kg', v_transfer.weight_kg
            ),
        updated_at = NOW()
    WHERE storage_location_id = v_transfer.from_storage_location_id
    AND size_class = v_transfer.size_class
    AND total_pieces >= v_transfer.quantity;
    
    -- Update storage capacities
    PERFORM update_storage_capacity_from_inventory();
    
    RETURN QUERY SELECT TRUE, 'Transfer approved - inventory moved with old storage location tracked'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Create approve_batch_transfer function
CREATE OR REPLACE FUNCTION approve_batch_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
BEGIN
    -- For now, batch transfers work the same as single transfers
    RETURN QUERY SELECT * FROM approve_transfer(p_transfer_id, p_approved_by);
END;
$$ LANGUAGE plpgsql;

-- Create decline_transfer function
CREATE OR REPLACE FUNCTION decline_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
BEGIN
    UPDATE transfers
    SET 
        status = 'declined',
        approved_by = p_approved_by,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF FOUND THEN
        RETURN QUERY SELECT TRUE, 'Transfer declined successfully'::TEXT;
    ELSE
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get transfer history for inventory
CREATE OR REPLACE FUNCTION get_inventory_transfer_history(
    p_sorting_result_id UUID
) RETURNS TABLE(
    transfer_id UUID,
    from_storage_name TEXT,
    to_storage_name TEXT,
    transferred_at TIMESTAMP WITH TIME ZONE,
    transferred_by TEXT,
    quantity INTEGER,
    weight_kg DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (history_item->>'transfer_id')::UUID as transfer_id,
        sl1.name as from_storage_name,
        sl2.name as to_storage_name,
        (history_item->>'transferred_at')::TIMESTAMP WITH TIME ZONE as transferred_at,
        (history_item->>'transferred_by')::TEXT as transferred_by,
        (history_item->>'quantity')::INTEGER as quantity,
        (history_item->>'weight_kg')::DECIMAL as weight_kg
    FROM sorting_results sr,
         jsonb_array_elements(sr.transfer_history) as history_item
    LEFT JOIN storage_locations sl1 ON (history_item->>'from_storage')::UUID = sl1.id
    LEFT JOIN storage_locations sl2 ON (history_item->>'to_storage')::UUID = sl2.id
    WHERE sr.id = p_sorting_result_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_batch_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_transfer_history(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION approve_batch_transfer(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_inventory_transfer_history(UUID) TO anon;

-- Success message
SELECT 'Transfer system with old storage location tracking implemented!' as status;
