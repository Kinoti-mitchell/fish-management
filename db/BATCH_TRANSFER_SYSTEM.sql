-- Batch Transfer System - Handle Multiple Sizes in One Transfer
-- Extends the existing transfer system to support batch transfers

-- 1. Create batch transfer function
CREATE OR REPLACE FUNCTION create_batch_transfer(
    p_from_storage_location_id UUID,
    p_to_storage_location_id UUID,
    p_size_data JSONB, -- Array of {size: int, quantity: int, weight_kg: decimal}
    p_notes TEXT DEFAULT NULL,
    p_requested_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_transfer_id UUID;
    v_from_name TEXT;
    v_to_name TEXT;
    v_size_item JSONB;
    v_total_weight DECIMAL(10,2) := 0;
    v_total_quantity INTEGER := 0;
    v_size_list TEXT := '';
BEGIN
    -- Get storage names
    SELECT name INTO v_from_name FROM storage_locations WHERE id = p_from_storage_location_id;
    SELECT name INTO v_to_name FROM storage_locations WHERE id = p_to_storage_location_id;
    
    -- Calculate totals and build size list
    FOR v_size_item IN SELECT * FROM jsonb_array_elements(p_size_data)
    LOOP
        v_total_weight := v_total_weight + (v_size_item->>'weight_kg')::DECIMAL(10,2);
        v_total_quantity := v_total_quantity + (v_size_item->>'quantity')::INTEGER;
        v_size_list := v_size_list || 'Size ' || (v_size_item->>'size')::TEXT || ', ';
    END LOOP;
    
    -- Remove trailing comma
    v_size_list := TRIM(TRAILING ', ' FROM v_size_list);
    
    -- Create the main transfer record
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
        -1, -- Use -1 to indicate batch transfer
        v_total_quantity,
        v_total_weight,
        COALESCE(p_notes, '') || ' | Sizes: ' || v_size_list,
        p_requested_by,
        'pending'
    ) RETURNING id INTO v_transfer_id;
    
    -- Create individual size records for detailed tracking
    FOR v_size_item IN SELECT * FROM jsonb_array_elements(p_size_data)
    LOOP
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
            status,
            parent_transfer_id
        ) VALUES (
            p_from_storage_location_id,
            p_to_storage_location_id,
            COALESCE(v_from_name, 'Unknown'),
            COALESCE(v_to_name, 'Unknown'),
            (v_size_item->>'size')::INTEGER,
            (v_size_item->>'quantity')::INTEGER,
            (v_size_item->>'weight_kg')::DECIMAL(10,2),
            'Part of batch transfer - ' || COALESCE(p_notes, ''),
            p_requested_by,
            'pending',
            v_transfer_id
        );
    END LOOP;
    
    RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql;

-- 2. Create batch approval function
CREATE OR REPLACE FUNCTION approve_batch_transfer(
    p_transfer_id UUID,
    p_approved_by TEXT
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transfer RECORD;
    v_approved_by_uuid UUID;
    v_child_transfers RECORD;
BEGIN
    -- Convert text to UUID, handle 'system' case
    IF p_approved_by = 'system' THEN
        v_approved_by_uuid := NULL;
    ELSE
        BEGIN
            v_approved_by_uuid := p_approved_by::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_approved_by_uuid := NULL;
        END;
    END IF;
    
    -- Get the main transfer record
    SELECT * INTO v_transfer
    FROM transfers
    WHERE id = p_transfer_id AND status = 'pending' AND size_class = -1;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Batch transfer not found or already processed'::TEXT;
        RETURN;
    END IF;
    
    -- Process each child transfer (individual sizes)
    FOR v_child_transfers IN 
        SELECT * FROM transfers 
        WHERE parent_transfer_id = p_transfer_id AND status = 'pending'
    LOOP
        -- Move fish from source to destination storage for this size
        UPDATE sorting_results 
        SET storage_location_id = v_transfer.to_storage_location_id, updated_at = NOW()
        WHERE storage_location_id = v_transfer.from_storage_location_id
        AND size_class = v_child_transfers.size_class;
        
        -- Mark child transfer as completed
        UPDATE transfers
        SET status = 'completed',
            approved_by = v_approved_by_uuid,
            approved_at = NOW(),
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = v_child_transfers.id;
    END LOOP;
    
    -- Update main transfer status to completed
    UPDATE transfers
    SET status = 'completed', 
        approved_by = v_approved_by_uuid, 
        approved_at = NOW(), 
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id;
    
    -- Update storage capacities
    PERFORM update_storage_capacity_from_inventory();
    
    RETURN QUERY SELECT TRUE, 'Batch transfer approved and completed successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 3. Add parent_transfer_id column to transfers table
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS parent_transfer_id UUID REFERENCES transfers(id);

-- 4. Create index for parent transfers
CREATE INDEX IF NOT EXISTS idx_transfers_parent ON transfers(parent_transfer_id);

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION create_batch_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION create_batch_transfer TO anon;
GRANT EXECUTE ON FUNCTION approve_batch_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION approve_batch_transfer TO anon;
