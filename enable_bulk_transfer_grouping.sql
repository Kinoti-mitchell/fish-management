-- Enable Bulk Transfer Grouping and Approval
-- This ensures bulk transfers are grouped together and approved as one unit

-- Step 1: Clean up existing invalid transfers
DELETE FROM transfers 
WHERE weight_kg = 0 OR weight_kg IS NULL;

-- Step 2: Update the create_batch_transfer function to create proper bulk transfers
DROP FUNCTION IF EXISTS create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID);

-- Create improved create_batch_transfer function for proper bulk transfers
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
    v_batch_notes TEXT;
BEGIN
    -- Get storage names
    SELECT name INTO v_from_name FROM storage_locations WHERE id = p_from_storage_location_id;
    SELECT name INTO v_to_name FROM storage_locations WHERE id = p_to_storage_location_id;
    
    -- Calculate total weight and size list for bulk transfer notes
    FOR v_size_item IN SELECT * FROM jsonb_array_elements(p_size_data)
    LOOP
        v_size := (v_size_item->>'size')::INTEGER;
        v_weight_kg := (v_size_item->>'weightKg')::DECIMAL(10,2);
        
        IF v_weight_kg > 0 THEN
            v_total_weight := v_total_weight + v_weight_kg;
            v_size_list := v_size_list || 'Size ' || v_size::TEXT || ', ';
        END IF;
    END LOOP;
    
    -- Create bulk transfer notes
    v_batch_notes := COALESCE(p_notes, '') || ' - Bulk transfer: ' || TRIM(TRAILING ', ' FROM v_size_list) || ' (Total: ' || v_total_weight::TEXT || 'kg)';
    
    -- Process each size item, but only create transfers for sizes with actual weight
    FOR v_size_item IN SELECT * FROM jsonb_array_elements(p_size_data)
    LOOP
        v_size := (v_size_item->>'size')::INTEGER;
        v_weight_kg := (v_size_item->>'weightKg')::DECIMAL(10,2);
        
        -- Only create transfer if there's actual weight (weight > 0)
        IF v_weight_kg > 0 THEN
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
                1, -- Default quantity to 1 since we focus on weight
                v_weight_kg,
                v_batch_notes, -- Same notes for all transfers in the batch
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

-- Step 3: Ensure the approve_transfer function handles bulk transfers properly
DROP FUNCTION IF EXISTS approve_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS approve_batch_transfer(UUID, UUID);

-- Create approve_transfer function that handles both single and bulk transfers
CREATE OR REPLACE FUNCTION approve_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transfer RECORD;
    v_updated_rows INTEGER;
    v_success_count INTEGER := 0;
    v_total_count INTEGER := 0;
    v_current_transfer RECORD;
BEGIN
    -- Get the transfer record
    SELECT * INTO v_transfer
    FROM transfers
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT;
        RETURN;
    END IF;
    
    -- Count total transfers in this batch (same from/to storage, same timestamp, same notes)
    SELECT COUNT(*) INTO v_total_count
    FROM transfers t
    WHERE t.from_storage_location_id = v_transfer.from_storage_location_id
    AND t.to_storage_location_id = v_transfer.to_storage_location_id
    AND t.created_at = v_transfer.created_at
    AND COALESCE(t.notes, '') = COALESCE(v_transfer.notes, '')
    AND t.status = 'pending';
    
    -- Process each transfer in the batch
    FOR v_current_transfer IN 
        SELECT * FROM transfers t
        WHERE t.from_storage_location_id = v_transfer.from_storage_location_id
        AND t.to_storage_location_id = v_transfer.to_storage_location_id
        AND t.created_at = v_transfer.created_at
        AND COALESCE(t.notes, '') = COALESCE(v_transfer.notes, '')
        AND t.status = 'pending'
    LOOP
        -- Move inventory for this transfer
        UPDATE sorting_results
        SET 
            previous_storage_location_id = storage_location_id,
            storage_location_id = v_current_transfer.to_storage_location_id,
            updated_at = NOW()
        WHERE storage_location_id = v_current_transfer.from_storage_location_id
        AND size_class = v_current_transfer.size_class
        AND total_pieces >= v_current_transfer.quantity;
        
        GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
        
        IF v_updated_rows > 0 THEN
            -- Successfully moved inventory - mark transfer as approved
            UPDATE transfers
            SET 
                status = 'approved',
                approved_by = p_approved_by,
                approved_at = NOW(),
                updated_at = NOW()
            WHERE id = v_current_transfer.id;
            
            v_success_count := v_success_count + 1;
        ELSE
            -- Failed to move inventory - mark transfer as declined
            UPDATE transfers
            SET 
                status = 'declined',
                approved_by = p_approved_by,
                approved_at = NOW(),
                updated_at = NOW()
            WHERE id = v_current_transfer.id;
        END IF;
    END LOOP;
    
    -- Update storage capacities
    PERFORM update_storage_capacity_from_inventory();
    
    -- Return result based on success count
    IF v_success_count = 0 THEN
        RETURN QUERY SELECT FALSE, 'No inventory could be moved for any transfers in the batch'::TEXT;
    ELSIF v_success_count = v_total_count THEN
        RETURN QUERY SELECT TRUE, 
            format('All %s transfers in bulk transfer approved and completed successfully', v_total_count)::TEXT;
    ELSE
        RETURN QUERY SELECT TRUE, 
            format('%s of %s transfers in bulk transfer completed successfully', v_success_count, v_total_count)::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create approve_batch_transfer function (same as approve_transfer)
CREATE OR REPLACE FUNCTION approve_batch_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
BEGIN
    -- Batch transfers work the same as single transfers (they're already grouped)
    RETURN QUERY SELECT * FROM approve_transfer(p_transfer_id, p_approved_by);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION approve_batch_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_batch_transfer(UUID, UUID) TO anon;

-- Step 4: Show remaining transfers to verify cleanup
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
SELECT 'Bulk transfer system enabled - transfers are grouped and approved as bulk units!' as status;
