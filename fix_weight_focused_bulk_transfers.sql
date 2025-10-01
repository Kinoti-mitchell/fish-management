-- Fix for Weight-Focused Bulk Transfers
-- Focus on weight only, not piece counts, and handle bulk transfers properly

-- Step 1: Clean up existing invalid transfers
DELETE FROM transfers 
WHERE weight_kg = 0 OR weight_kg IS NULL;

-- Step 2: Drop and recreate the create_batch_transfer function for weight-focused bulk transfers
DROP FUNCTION IF EXISTS create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID);

-- Create weight-focused create_batch_transfer function
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
    v_weight_kg DECIMAL(10,2);
    v_has_valid_inventory BOOLEAN := FALSE;
    v_total_weight DECIMAL(10,2) := 0;
    v_size_list TEXT := '';
BEGIN
    -- Get storage names
    SELECT name INTO v_from_name FROM storage_locations WHERE id = p_from_storage_location_id;
    SELECT name INTO v_to_name FROM storage_locations WHERE id = p_to_storage_location_id;
    
    -- Process each size item, but only create transfers for sizes with actual weight
    FOR v_size_item IN SELECT * FROM jsonb_array_elements(p_size_data)
    LOOP
        v_size := (v_size_item->>'size')::INTEGER;
        v_weight_kg := (v_size_item->>'weightKg')::DECIMAL(10,2);
        
        -- Only create transfer if there's actual weight (weight > 0)
        IF v_weight_kg > 0 THEN
            v_has_valid_inventory := TRUE;
            v_total_weight := v_total_weight + v_weight_kg;
            v_size_list := v_size_list || 'Size ' || v_size::TEXT || ', ';
            
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
                1, -- Default quantity to 1 since we focus on weight
                v_weight_kg,
                COALESCE(p_notes, '') || ' - Bulk transfer: ' || TRIM(TRAILING ', ' FROM v_size_list) || ' (Total: ' || v_total_weight::TEXT || 'kg)',
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
        RAISE EXCEPTION 'No valid inventory found to transfer. All sizes have zero weight.';
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
    notes,
    created_at
FROM transfers 
ORDER BY created_at DESC
LIMIT 5;

-- Success message
SELECT 'Weight-focused bulk transfer system implemented - focuses on weight only, handles bulk transfers properly!' as status;
