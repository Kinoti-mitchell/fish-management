-- Smart Transfer Fix - Use Real Inventory Data Instead of Dummy Records
-- This approach uses actual size data from the transfer instead of creating dummy processing records

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS approve_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS decline_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS approve_batch_transfer(UUID, UUID);

-- Create smart approve_transfer function that uses real inventory data
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
    v_source_inventory RECORD;
    v_warehouse_entry_id UUID;
    v_processing_record_id UUID;
    v_sorting_batch_id UUID;
BEGIN
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
    
    -- Reduce inventory in source storage
    UPDATE sorting_results
    SET 
        total_pieces = total_pieces - v_transfer.quantity,
        total_weight_grams = total_weight_grams - (v_transfer.weight_kg * 1000)::INTEGER,
        updated_at = NOW()
    WHERE storage_location_id = v_transfer.from_storage_location_id
    AND size_class = v_transfer.size_class;
    
    -- Check if destination already has inventory for this size
    SELECT * INTO v_existing_record
    FROM sorting_results
    WHERE storage_location_id = v_transfer.to_storage_location_id
    AND size_class = v_transfer.size_class
    LIMIT 1;
    
    IF FOUND THEN
        -- Update existing inventory in destination
        UPDATE sorting_results
        SET 
            total_pieces = total_pieces + v_transfer.quantity,
            total_weight_grams = total_weight_grams + (v_transfer.weight_kg * 1000)::INTEGER,
            updated_at = NOW()
        WHERE storage_location_id = v_transfer.to_storage_location_id
        AND size_class = v_transfer.size_class;
    ELSE
        -- Create new inventory record in destination
        -- First, get the sorting_batch_id from the source inventory
        SELECT sorting_batch_id INTO v_sorting_batch_id
        FROM sorting_results
        WHERE storage_location_id = v_transfer.from_storage_location_id
        AND size_class = v_transfer.size_class
        LIMIT 1;
        
        -- If no sorting_batch_id found, create a minimal one
        IF v_sorting_batch_id IS NULL THEN
            -- Get a warehouse entry for the processing record
            SELECT id INTO v_warehouse_entry_id FROM warehouse_entries LIMIT 1;
            
            -- Create a minimal processing record
            INSERT INTO processing_records (
                warehouse_entry_id,
                processing_date,
                processed_by,
                created_at,
                updated_at
            ) VALUES (
                v_warehouse_entry_id,
                NOW()::date,
                p_approved_by,
                NOW(),
                NOW()
            ) RETURNING id INTO v_processing_record_id;
            
            -- Create a sorting batch
            INSERT INTO sorting_batches (
                processing_record_id,
                batch_number,
                status,
                created_at,
                updated_at
            ) VALUES (
                v_processing_record_id,
                'TRANSFER-' || p_transfer_id::text,
                'completed',
                NOW(),
                NOW()
            ) RETURNING id INTO v_sorting_batch_id;
        END IF;
        
        -- Insert new inventory record in destination
        INSERT INTO sorting_results (
            sorting_batch_id,
            storage_location_id,
            size_class,
            total_pieces,
            total_weight_grams,
            created_at,
            updated_at
        ) VALUES (
            v_sorting_batch_id,
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_batch_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION approve_batch_transfer(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO anon;

-- Success message
SELECT 'Smart transfer system implemented - uses real inventory data!' as status;
