-- Comprehensive Transfer System Check and Fix
-- This script ensures all required functions and tables exist

-- 1. Check and create transfers table
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

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_from_storage ON transfers(from_storage_location_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_storage ON transfers(to_storage_location_id);
CREATE INDEX IF NOT EXISTS idx_transfers_created_at ON transfers(created_at);

-- 3. Create update_storage_capacity_from_inventory function if it doesn't exist
CREATE OR REPLACE FUNCTION update_storage_capacity_from_inventory()
RETURNS VOID AS $$
BEGIN
    -- Update storage capacity based on actual inventory
    UPDATE storage_locations 
    SET 
        current_usage_kg = COALESCE(
            (SELECT SUM(total_weight_grams) / 1000.0 
             FROM sorting_results 
             WHERE storage_location_id = storage_locations.id 
             AND total_weight_grams > 0), 
            0
        ),
        updated_at = NOW()
    WHERE status = 'active';
END;
$$ LANGUAGE plpgsql;

-- 4. Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS approve_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS decline_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS approve_batch_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS create_transfer(UUID, UUID, INTEGER, INTEGER, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID);
DROP FUNCTION IF EXISTS complete_transfer(UUID, UUID);

-- 5. Create create_transfer function
CREATE OR REPLACE FUNCTION create_transfer(
    p_from_storage_location_id UUID,
    p_to_storage_location_id UUID,
    p_size INTEGER,
    p_quantity INTEGER,
    p_weight_kg DECIMAL,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_transfer_id UUID;
    v_from_name TEXT;
    v_to_name TEXT;
BEGIN
    -- Get storage names
    SELECT name INTO v_from_name FROM storage_locations WHERE id = p_from_storage_location_id;
    SELECT name INTO v_to_name FROM storage_locations WHERE id = p_to_storage_location_id;
    
    -- Create transfer record
    INSERT INTO transfers (
        from_storage_location_id,
        to_storage_location_id,
        from_storage_name,
        to_storage_name,
        size_class,
        quantity,
        weight_kg,
        notes,
        status
    ) VALUES (
        p_from_storage_location_id,
        p_to_storage_location_id,
        v_from_name,
        v_to_name,
        p_size,
        p_quantity,
        p_weight_kg,
        p_notes,
        'pending'
    ) RETURNING id INTO v_transfer_id;
    
    RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Create create_batch_transfer function
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
    v_batch_transfer_id UUID;
    v_from_name TEXT;
    v_to_name TEXT;
    v_size_item JSONB;
BEGIN
    -- Get storage names
    SELECT name INTO v_from_name FROM storage_locations WHERE id = p_from_storage_location_id;
    SELECT name INTO v_to_name FROM storage_locations WHERE id = p_to_storage_location_id;
    
    -- Create batch transfer record (first transfer in batch)
    INSERT INTO transfers (
        from_storage_location_id,
        to_storage_location_id,
        from_storage_name,
        to_storage_name,
        size_class,
        quantity,
        weight_kg,
        notes,
        status,
        requested_by
    ) VALUES (
        p_from_storage_location_id,
        p_to_storage_location_id,
        v_from_name,
        v_to_name,
        0, -- Dummy size for batch record
        0, -- Dummy quantity for batch record
        0, -- Dummy weight for batch record
        p_notes,
        'pending',
        p_requested_by
    ) RETURNING id INTO v_batch_transfer_id;
    
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
            status,
            requested_by
        ) VALUES (
            p_from_storage_location_id,
            p_to_storage_location_id,
            v_from_name,
            v_to_name,
            (v_size_item->>'size')::INTEGER,
            COALESCE((v_size_item->>'quantity')::INTEGER, 1),
            (v_size_item->>'weightKg')::DECIMAL,
            p_notes,
            'pending',
            p_requested_by
        ) RETURNING id INTO v_transfer_id;
        
        -- Store first transfer ID for return
        IF v_first_transfer_id IS NULL THEN
            v_first_transfer_id := v_transfer_id;
        END IF;
    END LOOP;
    
    RETURN v_first_transfer_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Create approve_transfer function
CREATE OR REPLACE FUNCTION approve_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transfer RECORD;
    v_existing_record RECORD;
    v_transfer_batch_id UUID;
    v_dummy_processing_record_id UUID;
BEGIN
    SELECT * INTO v_transfer
    FROM transfers
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT;
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
        total_weight_grams = total_weight_grams - (v_transfer.weight_kg * 1000)::INTEGER
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
    
    -- Add inventory to destination storage
    -- Check if a record already exists for this storage_location_id and size_class
    SELECT * INTO v_existing_record
    FROM sorting_results
    WHERE storage_location_id = v_transfer.to_storage_location_id
    AND size_class = v_transfer.size_class
    LIMIT 1;
    
    IF FOUND THEN
        -- Update existing record
        UPDATE sorting_results
        SET 
            total_pieces = total_pieces + v_transfer.quantity,
            total_weight_grams = total_weight_grams + (v_transfer.weight_kg * 1000)::INTEGER,
            updated_at = NOW()
        WHERE storage_location_id = v_transfer.to_storage_location_id
        AND size_class = v_transfer.size_class;
    ELSE
        -- Create a dummy processing record first to satisfy the constraint
        INSERT INTO processing_records (
            warehouse_entry_id,
            processing_date,
            processed_by,
            pre_processing_weight,
            post_processing_weight,
            processing_waste,
            processing_yield,
            ready_for_dispatch_count,
            created_at,
            updated_at
        ) VALUES (
            (SELECT id FROM warehouse_entries LIMIT 1), -- Use any existing warehouse entry
            NOW()::date,
            p_approved_by,
            0,
            0,
            0,
            0,
            0,
            NOW(),
            NOW()
        ) RETURNING id INTO v_dummy_processing_record_id;
        
        -- Create a special "transfer batch" to satisfy the sorting_batch_id constraint
        INSERT INTO sorting_batches (
            processing_record_id,
            batch_number,
            status,
            created_at,
            updated_at
        ) VALUES (
            v_dummy_processing_record_id,
            'TRANSFER-' || p_transfer_id::text,
            'completed',
            NOW(),
            NOW()
        ) RETURNING id INTO v_transfer_batch_id;
        
        -- Insert new record with the transfer batch ID
        INSERT INTO sorting_results (
            sorting_batch_id,
            storage_location_id,
            size_class,
            total_pieces,
            total_weight_grams,
            created_at,
            updated_at
        ) VALUES (
            v_transfer_batch_id,
            v_transfer.to_storage_location_id,
            v_transfer.size_class,
            v_transfer.quantity,
            (v_transfer.weight_kg * 1000)::INTEGER,
            NOW(),
            NOW()
        );
    END IF;
    
    -- Update storage capacities
    PERFORM update_storage_capacity_from_inventory();
    
    RETURN QUERY SELECT TRUE, 'Transfer approved and executed successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 8. Create approve_batch_transfer function
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

-- 9. Create decline_transfer function
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

-- 10. Create complete_transfer function
CREATE OR REPLACE FUNCTION complete_transfer(
    p_transfer_id UUID,
    p_completed_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
BEGIN
    UPDATE transfers
    SET 
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id AND status = 'approved';
    
    IF FOUND THEN
        RETURN QUERY SELECT TRUE, 'Transfer completed successfully'::TEXT;
    ELSE
        RETURN QUERY SELECT FALSE, 'Transfer not found or not approved'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 11. Grant permissions
GRANT EXECUTE ON FUNCTION create_transfer(UUID, UUID, INTEGER, INTEGER, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_batch_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_storage_capacity_from_inventory() TO authenticated;

GRANT EXECUTE ON FUNCTION create_transfer(UUID, UUID, INTEGER, INTEGER, DECIMAL, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_batch_transfer(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION complete_transfer(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION update_storage_capacity_from_inventory() TO anon;

-- 12. Success message
SELECT 'Comprehensive transfer system setup completed successfully!' as status;
