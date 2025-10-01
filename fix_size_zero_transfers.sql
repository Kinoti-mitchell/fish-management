-- Fix Size 0 transfers with 0kg weight
-- Only create transfers for sizes that actually have inventory

-- Drop existing function to recreate it
DROP FUNCTION IF EXISTS create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID);

-- Create improved create_batch_transfer function that filters out zero inventory
CREATE OR REPLACE FUNCTION create_batch_transfer(
    p_from_storage_location_id UUID,
    p_to_storage_location_id UUID,
    p_size_data JSONB,
    p_notes TEXT DEFAULT NULL,
    p_requested_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_transfer_id UUID;
    v_first_transfer_id UUID;
    v_size_item JSONB;
    v_from_name TEXT;
    v_to_name TEXT;
    v_size INTEGER;
    v_quantity INTEGER;
    v_weight_kg DECIMAL(10,2);
    v_has_valid_inventory BOOLEAN := FALSE;
BEGIN
    -- Get storage names
    SELECT name INTO v_from_name FROM storage_locations WHERE id = p_from_storage_location_id;
    SELECT name INTO v_to_name FROM storage_locations WHERE id = p_to_storage_location_id;
    
    -- Process each size item, but only create transfers for sizes with actual inventory
    FOR v_size_item IN SELECT * FROM jsonb_array_elements(p_size_data)
    LOOP
        v_size := (v_size_item->>'size')::INTEGER;
        v_quantity := COALESCE((v_size_item->>'quantity')::INTEGER, 1);
        v_weight_kg := (v_size_item->>'weightKg')::DECIMAL(10,2);
        
        -- Only create transfer if there's actual inventory (weight > 0 and quantity > 0)
        IF v_weight_kg > 0 AND v_quantity > 0 THEN
            v_has_valid_inventory := TRUE;
            
            INSERT INTO transfers (
                from_storage_location_id,
                to_storage_location_id,
                from_storage_name,
                to_storage_name,
                size_class,
                quantity,
                weight_kg,
                notes,
                requested_by,
                status
            ) VALUES (
                p_from_storage_location_id,
                p_to_storage_location_id,
                COALESCE(v_from_name, 'Unknown'),
                COALESCE(v_to_name, 'Unknown'),
                v_size,
                v_quantity,
                v_weight_kg,
                p_notes,
                p_requested_by,
                'pending'
            ) RETURNING id INTO v_transfer_id;
            
            -- Store the first transfer ID to return
            IF v_first_transfer_id IS NULL THEN
                v_first_transfer_id := v_transfer_id;
            END IF;
        END IF;
    END LOOP;
    
    -- If no valid inventory was found, raise an error
    IF NOT v_has_valid_inventory THEN
        RAISE EXCEPTION 'No valid inventory found to transfer. All sizes have zero weight or quantity.';
    END IF;
    
    RETURN v_first_transfer_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID) TO anon;

-- Success message
SELECT 'Size 0 transfer fix applied - only creates transfers for sizes with actual inventory!' as status;
