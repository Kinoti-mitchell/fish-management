-- Unified Transfer System - Single Table Approach
-- Replaces both transfer_requests and transfer_log with one comprehensive table

-- 1. Drop existing transfer tables if they exist
DROP TABLE IF EXISTS transfer_requests CASCADE;
DROP TABLE IF EXISTS transfer_log CASCADE;

-- 2. Create unified transfer table
CREATE TABLE transfers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_storage_location_id UUID NOT NULL,
    to_storage_location_id UUID NOT NULL,
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

-- 4. Create simplified functions
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
BEGIN
    INSERT INTO transfers (
        from_storage_location_id,
        to_storage_location_id,
        size_class,
        quantity,
        weight_kg,
        notes,
        requested_by,
        status
    ) VALUES (
        p_from_storage_location_id,
        p_to_storage_location_id,
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

-- 5. Create view for easy querying
CREATE OR REPLACE VIEW transfer_history AS
SELECT 
    t.id,
    t.from_storage_location_id,
    t.to_storage_location_id,
    t.size_class,
    t.quantity,
    t.weight_kg,
    t.notes,
    t.status,
    t.requested_by,
    t.approved_by,
    t.approved_at,
    t.completed_at,
    t.created_at,
    t.updated_at,
    from_storage.name as from_storage_name,
    to_storage.name as to_storage_name
FROM transfers t
LEFT JOIN storage_locations from_storage ON t.from_storage_location_id = from_storage.id
LEFT JOIN storage_locations to_storage ON t.to_storage_location_id = to_storage.id
ORDER BY t.created_at DESC;

-- 6. Disable RLS and Grant Permissions
ALTER TABLE transfers DISABLE ROW LEVEL SECURITY;

GRANT ALL ON transfers TO authenticated;
GRANT ALL ON transfers TO anon;
GRANT ALL ON transfer_history TO authenticated;
GRANT ALL ON transfer_history TO anon;

GRANT EXECUTE ON FUNCTION create_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION approve_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION create_transfer TO anon;
GRANT EXECUTE ON FUNCTION approve_transfer TO anon;
GRANT EXECUTE ON FUNCTION decline_transfer TO anon;

-- 7. Update storage capacities
SELECT update_storage_capacity_from_inventory();
