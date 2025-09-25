-- Simple Unified Transfer System - No Foreign Keys
-- Creates a single transfers table without complex relationships

-- 1. Drop existing transfer tables if they exist
DROP TABLE IF EXISTS transfer_requests CASCADE;
DROP TABLE IF EXISTS transfer_log CASCADE;
DROP TABLE IF EXISTS transfers CASCADE;

-- 2. Create simple unified transfer table
CREATE TABLE transfers (
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

-- 3. Create indexes for better performance
CREATE INDEX idx_transfers_status ON transfers(status);
CREATE INDEX idx_transfers_from_storage ON transfers(from_storage_location_id);
CREATE INDEX idx_transfers_to_storage ON transfers(to_storage_location_id);
CREATE INDEX idx_transfers_created_at ON transfers(created_at);

-- 4. Create simple functions
CREATE OR REPLACE FUNCTION create_transfer(
    p_from_storage_location_id UUID,
    p_to_storage_location_id UUID,
    p_size INTEGER,
    p_quantity INTEGER,
    p_weight_kg DECIMAL(10,2),
    p_notes TEXT DEFAULT NULL,
    p_requested_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_transfer_id UUID;
    v_from_name TEXT;
    v_to_name TEXT;
BEGIN
    -- Get storage names
    SELECT name INTO v_from_name FROM storage_locations WHERE id = p_from_storage_location_id;
    SELECT name INTO v_to_name FROM storage_locations WHERE id = p_to_storage_location_id;
    
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
        p_size,
        p_quantity,
        p_weight_kg,
        p_notes,
        p_requested_by,
        'pending'
    ) RETURNING id INTO v_transfer_id;
    
    RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql;

-- Create batch transfer function (creates individual transfers for each size)
CREATE OR REPLACE FUNCTION create_batch_transfer(
    p_from_storage_location_id UUID,
    p_to_storage_location_id UUID,
    p_size_data JSONB,
    p_notes TEXT DEFAULT NULL,
    p_requested_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_batch_transfer_id UUID;
    v_from_name TEXT;
    v_to_name TEXT;
    v_size_item JSONB;
    v_first_transfer_id UUID;
BEGIN
    -- Get storage names
    SELECT name INTO v_from_name FROM storage_locations WHERE id = p_from_storage_location_id;
    SELECT name INTO v_to_name FROM storage_locations WHERE id = p_to_storage_location_id;
    
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

CREATE OR REPLACE FUNCTION approve_transfer(
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
    
    -- Move fish from source to destination storage
    UPDATE sorting_results 
    SET storage_location_id = v_transfer.to_storage_location_id, updated_at = NOW()
    WHERE storage_location_id = v_transfer.from_storage_location_id
    AND size_class = v_transfer.size_class;
    
    -- Update storage capacities
    PERFORM update_storage_capacity_from_inventory();
    
    -- Update transfer status to completed
    UPDATE transfers
    SET status = 'completed', 
        approved_by = p_approved_by, 
        approved_at = NOW(), 
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id;
    
    RETURN QUERY SELECT TRUE, 'Transfer approved and completed successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Create batch transfer approval function (works like regular approve_transfer)
CREATE OR REPLACE FUNCTION approve_batch_transfer(
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
    
    -- Move fish from source to destination storage
    UPDATE sorting_results 
    SET storage_location_id = v_transfer.to_storage_location_id, updated_at = NOW()
    WHERE storage_location_id = v_transfer.from_storage_location_id
    AND size_class = v_transfer.size_class;
    
    -- Update storage capacities
    PERFORM update_storage_capacity_from_inventory();
    
    -- Update transfer status to completed
    UPDATE transfers
    SET status = 'completed', 
        approved_by = p_approved_by, 
        approved_at = NOW(), 
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id;
    
    RETURN QUERY SELECT TRUE, 'Transfer approved and completed successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decline_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE transfers
    SET status = 'declined', 
        approved_by = p_approved_by, 
        approved_at = NOW(), 
        updated_at = NOW()
    WHERE id = p_transfer_id AND status = 'pending';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 5. Disable RLS and Grant Permissions
ALTER TABLE transfers DISABLE ROW LEVEL SECURITY;

GRANT ALL ON transfers TO authenticated;
GRANT ALL ON transfers TO anon;

GRANT EXECUTE ON FUNCTION create_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION create_batch_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION approve_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION approve_batch_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION create_transfer TO anon;
GRANT EXECUTE ON FUNCTION create_batch_transfer TO anon;
GRANT EXECUTE ON FUNCTION approve_transfer TO anon;
GRANT EXECUTE ON FUNCTION approve_batch_transfer TO anon;
GRANT EXECUTE ON FUNCTION decline_transfer TO anon;

-- 6. Update storage capacities
SELECT update_storage_capacity_from_inventory();
