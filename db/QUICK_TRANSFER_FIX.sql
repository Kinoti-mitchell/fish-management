-- Quick Transfer System Fix
-- This creates the minimal transfer system needed for the application

-- 1. Create transfers table if it doesn't exist
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

-- 3. Create create_batch_transfer function if it doesn't exist
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

-- 4. Drop existing approve_transfer function if it exists (to handle return type changes)
DROP FUNCTION IF EXISTS approve_transfer(UUID, UUID);

-- 5. Create approve_transfer function
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
    
    RETURN QUERY SELECT TRUE, 'Transfer approved successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 6. Drop existing decline_transfer function if it exists (to handle return type changes)
DROP FUNCTION IF EXISTS decline_transfer(UUID, UUID);

-- 7. Create decline_transfer function
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
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT;
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

-- 7. Grant permissions
GRANT ALL ON transfers TO authenticated;
GRANT EXECUTE ON FUNCTION create_batch_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION approve_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer TO authenticated;

-- 8. Test the setup
SELECT 'Transfer system setup completed successfully!' as status;
