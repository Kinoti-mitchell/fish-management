-- Complete Fix for Size 0 Transfers Issue
-- 1. Clean up existing invalid transfers
-- 2. Fix the create_batch_transfer function to prevent future Size 0 transfers

-- Step 1: Clean up existing Size 0 transfers with 0kg weight
DELETE FROM transfers 
WHERE size_class = 0 AND weight_kg = 0;

-- Also delete any transfers with 0kg weight (they shouldn't exist)
DELETE FROM transfers 
WHERE weight_kg = 0;

-- Step 2: Drop and recreate the create_batch_transfer function
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

-- Step 3: Show remaining transfers to verify cleanup
SELECT 
    'Remaining transfers after cleanup:' as info,
    COUNT(*) as total_transfers
FROM transfers;

SELECT 
    id,
    from_storage_name,
    to_storage_name,
    size_class,
    weight_kg,
    quantity,
    status,
    created_at
FROM transfers 
ORDER BY created_at DESC
LIMIT 5;

-- Success message
SELECT 'Complete Size 0 transfer fix applied - cleaned up invalid transfers and prevented future ones!' as status;
