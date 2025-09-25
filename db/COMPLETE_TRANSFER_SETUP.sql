-- COMPLETE TRANSFER SYSTEM SETUP
-- This single script sets up the entire transfer system
-- Run this in your Supabase SQL editor

-- ==============================================
-- 1. CLEANUP: Drop existing functions to avoid conflicts
-- ==============================================
DROP FUNCTION IF EXISTS approve_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS decline_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID);

-- ==============================================
-- 2. ADD TRANSFER TRACKING COLUMNS TO SORTING_RESULTS
-- ==============================================
-- Add columns to track transfer source information
ALTER TABLE sorting_results 
ADD COLUMN IF NOT EXISTS transfer_source_storage_id UUID,
ADD COLUMN IF NOT EXISTS transfer_source_storage_name TEXT,
ADD COLUMN IF NOT EXISTS transfer_id UUID;

-- Add foreign key constraint for transfer tracking
ALTER TABLE sorting_results 
ADD CONSTRAINT IF NOT EXISTS fk_transfer_source_storage 
FOREIGN KEY (transfer_source_storage_id) REFERENCES storage_locations(id);

ALTER TABLE sorting_results 
ADD CONSTRAINT IF NOT EXISTS fk_transfer_id 
FOREIGN KEY (transfer_id) REFERENCES transfers(id);

-- ==============================================
-- 3. CREATE TRANSFERS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS transfers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_storage_location_id UUID NOT NULL,
    to_storage_location_id UUID NOT NULL,
    from_storage_name TEXT,
    to_storage_name TEXT,
    size_class INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    weight_kg DECIMAL(10,2) NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'completed')),
    requested_by UUID,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ==============================================
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_from_storage ON transfers(from_storage_location_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_storage ON transfers(to_storage_location_id);
CREATE INDEX IF NOT EXISTS idx_transfers_created_at ON transfers(created_at);

-- ==============================================
-- 4. CREATE BATCH TRANSFER FUNCTION
-- ==============================================
CREATE FUNCTION create_batch_transfer(
    p_from_storage_location_id UUID,
    p_to_storage_location_id UUID,
    p_size_data JSONB,
    p_notes TEXT DEFAULT NULL,
    p_requested_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_batch_transfer_id UUID;
    v_first_transfer_id UUID;
    v_size_item JSONB;
    v_from_name TEXT;
    v_to_name TEXT;
BEGIN
    -- Get storage names
    SELECT name INTO v_from_name 
    FROM storage_locations 
    WHERE id = p_from_storage_location_id;
    
    SELECT name INTO v_to_name 
    FROM storage_locations 
    WHERE id = p_to_storage_location_id;
    
    -- Create individual transfer records for each size
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
            status
        ) VALUES (
            p_from_storage_location_id,
            p_to_storage_location_id,
            COALESCE(v_from_name, 'Unknown'),
            COALESCE(v_to_name, 'Unknown'),
            (v_size_item->>'size')::INTEGER,
            (v_size_item->>'quantity')::INTEGER,
            (v_size_item->>'weightKg')::DECIMAL(10,2),
            p_notes,
            p_requested_by,
            'pending'
        ) RETURNING id INTO v_first_transfer_id;
        
        -- Store the first transfer ID to return as the batch ID
        IF v_batch_transfer_id IS NULL THEN
            v_batch_transfer_id := v_first_transfer_id;
        END IF;
    END LOOP;
    
    RETURN v_batch_transfer_id;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 5. CREATE APPROVE TRANSFER FUNCTION
-- ==============================================
CREATE FUNCTION approve_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transfer RECORD;
BEGIN
    SELECT * INTO v_transfer
    FROM transfers
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer request not found or already processed'::TEXT;
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
    
    -- Move inventory from source to destination storage
    -- First, reduce inventory in source storage
    UPDATE sorting_results
    SET 
        total_pieces = total_pieces - v_transfer.quantity,
        total_weight_grams = total_weight_grams - (v_transfer.weight_kg * 1000)
    WHERE storage_location_id = v_transfer.from_storage_location_id
    AND size_class = v_transfer.size_class
    AND total_pieces >= v_transfer.quantity;
    
    -- Check if the update was successful (inventory was sufficient)
    IF NOT FOUND THEN
        -- Rollback the transfer status
        UPDATE transfers
        SET 
            status = 'pending',
            approved_by = NULL,
            approved_at = NULL,
            updated_at = NOW()
        WHERE id = p_transfer_id;
        
        RETURN QUERY SELECT FALSE, 'Insufficient inventory in source storage'::TEXT;
        RETURN;
    END IF;
    
            -- Add inventory to destination storage with transfer tracking
            INSERT INTO sorting_results (
                sorting_batch_id,
                storage_location_id,
                size_class,
                total_pieces,
                total_weight_grams,
                created_at,
                updated_at,
                transfer_source_storage_id,
                transfer_source_storage_name,
                transfer_id
            ) VALUES (
                (SELECT id FROM sorting_batches LIMIT 1), -- Use first batch as reference
                v_transfer.to_storage_location_id,
                v_transfer.size_class,
                v_transfer.quantity,
                v_transfer.weight_kg * 1000,
                NOW(),
                NOW(),
                v_transfer.from_storage_location_id,
                v_transfer.from_storage_name,
                v_transfer.id
            )
            ON CONFLICT (storage_location_id, size_class) 
            DO UPDATE SET
                total_pieces = sorting_results.total_pieces + v_transfer.quantity,
                total_weight_grams = sorting_results.total_weight_grams + (v_transfer.weight_kg * 1000),
                updated_at = NOW(),
                transfer_source_storage_id = COALESCE(sorting_results.transfer_source_storage_id, v_transfer.from_storage_location_id),
                transfer_source_storage_name = COALESCE(sorting_results.transfer_source_storage_name, v_transfer.from_storage_name),
                transfer_id = COALESCE(sorting_results.transfer_id, v_transfer.id);
    
    -- Mark transfer as completed
    UPDATE transfers
    SET 
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id;
    
    RETURN QUERY SELECT TRUE, 'Transfer approved and inventory moved successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 6. CREATE BATCH APPROVAL FUNCTION
-- ==============================================
CREATE FUNCTION approve_batch_transfer(
    p_batch_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_batch_transfers RECORD[];
    v_count INTEGER;
BEGIN
    -- Get all transfers in the batch (same from/to storage, same timestamp, same notes)
    SELECT array_agg(t.*) INTO v_batch_transfers
    FROM transfers t
    WHERE t.id = p_batch_id 
    OR (
        t.from_storage_location_id = (SELECT from_storage_location_id FROM transfers WHERE id = p_batch_id)
        AND t.to_storage_location_id = (SELECT to_storage_location_id FROM transfers WHERE id = p_batch_id)
        AND t.created_at = (SELECT created_at FROM transfers WHERE id = p_batch_id)
        AND t.notes = (SELECT notes FROM transfers WHERE id = p_batch_id)
        AND t.status = 'pending'
    );
    
    IF v_batch_transfers IS NULL OR array_length(v_batch_transfers, 1) = 0 THEN
        RETURN QUERY SELECT FALSE, 'No pending transfers found for this batch'::TEXT;
        RETURN;
    END IF;
    
    -- Move inventory for each transfer in the batch
    FOR i IN 1..array_length(v_batch_transfers, 1) LOOP
        DECLARE
            v_transfer RECORD := v_batch_transfers[i];
        BEGIN
            -- Reduce inventory in source storage
            UPDATE sorting_results
            SET 
                total_pieces = total_pieces - v_transfer.quantity,
                total_weight_grams = total_weight_grams - (v_transfer.weight_kg * 1000)
            WHERE storage_location_id = v_transfer.from_storage_location_id
            AND size_class = v_transfer.size_class
            AND total_pieces >= v_transfer.quantity;
            
            -- Check if the update was successful
            IF NOT FOUND THEN
                RETURN QUERY SELECT FALSE, format('Insufficient inventory for size %s in source storage', v_transfer.size_class)::TEXT;
                RETURN;
            END IF;
            
            -- Add inventory to destination storage with transfer tracking
            INSERT INTO sorting_results (
                sorting_batch_id,
                storage_location_id,
                size_class,
                total_pieces,
                total_weight_grams,
                created_at,
                updated_at,
                transfer_source_storage_id,
                transfer_source_storage_name,
                transfer_id
            ) VALUES (
                (SELECT id FROM sorting_batches LIMIT 1),
                v_transfer.to_storage_location_id,
                v_transfer.size_class,
                v_transfer.quantity,
                v_transfer.weight_kg * 1000,
                NOW(),
                NOW(),
                v_transfer.from_storage_location_id,
                v_transfer.from_storage_name,
                v_transfer.id
            )
            ON CONFLICT (storage_location_id, size_class) 
            DO UPDATE SET
                total_pieces = sorting_results.total_pieces + v_transfer.quantity,
                total_weight_grams = sorting_results.total_weight_grams + (v_transfer.weight_kg * 1000),
                updated_at = NOW(),
                transfer_source_storage_id = COALESCE(sorting_results.transfer_source_storage_id, v_transfer.from_storage_location_id),
                transfer_source_storage_name = COALESCE(sorting_results.transfer_source_storage_name, v_transfer.from_storage_name),
                transfer_id = COALESCE(sorting_results.transfer_id, v_transfer.id);
        END;
    END LOOP;
    
    -- Update all transfers in the batch to completed
    UPDATE transfers
    SET 
        status = 'completed',
        approved_by = p_approved_by,
        approved_at = NOW(),
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = ANY(
        SELECT unnest(v_batch_transfers).id
    );
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN QUERY SELECT TRUE, format('Batch transfer approved and inventory moved successfully. %s transfers completed.', v_count)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 7. CREATE BATCH DECLINE FUNCTION
-- ==============================================
CREATE FUNCTION decline_batch_transfer(
    p_batch_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_batch_transfers RECORD[];
    v_count INTEGER;
BEGIN
    -- Get all transfers in the batch
    SELECT array_agg(t.*) INTO v_batch_transfers
    FROM transfers t
    WHERE t.id = p_batch_id 
    OR (
        t.from_storage_location_id = (SELECT from_storage_location_id FROM transfers WHERE id = p_batch_id)
        AND t.to_storage_location_id = (SELECT to_storage_location_id FROM transfers WHERE id = p_batch_id)
        AND t.created_at = (SELECT created_at FROM transfers WHERE id = p_batch_id)
        AND t.notes = (SELECT notes FROM transfers WHERE id = p_batch_id)
        AND t.status = 'pending'
    );
    
    IF v_batch_transfers IS NULL OR array_length(v_batch_transfers, 1) = 0 THEN
        RETURN QUERY SELECT FALSE, 'No pending transfers found for this batch'::TEXT;
        RETURN;
    END IF;
    
    -- Update all transfers in the batch to declined
    UPDATE transfers
    SET 
        status = 'declined',
        approved_by = p_approved_by,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = ANY(
        SELECT unnest(v_batch_transfers).id
    );
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN QUERY SELECT TRUE, format('Batch transfer declined successfully. %s transfers declined.', v_count)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 8. CREATE DECLINE TRANSFER FUNCTION
-- ==============================================
CREATE FUNCTION decline_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transfer RECORD;
BEGIN
    SELECT * INTO v_transfer
    FROM transfers
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer request not found or already processed'::TEXT;
        RETURN;
    END IF;
    
    -- Update transfer status to declined
    UPDATE transfers
    SET 
        status = 'declined',
        approved_by = p_approved_by,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id;
    
    RETURN QUERY SELECT TRUE, 'Transfer declined successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 9. GRANT PERMISSIONS
-- ==============================================
GRANT ALL ON TABLE transfers TO authenticated;
GRANT EXECUTE ON FUNCTION create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_batch_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_batch_transfer(UUID, UUID) TO authenticated;

-- ==============================================
-- 8. SUCCESS MESSAGE
-- ==============================================
SELECT 'Transfer system setup completed successfully!' as status;
