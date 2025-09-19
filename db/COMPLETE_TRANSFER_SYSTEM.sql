-- Complete Transfer System - All in One
-- Creates tables, functions, and permissions for the transfer system

-- 1. Create Tables
CREATE TABLE IF NOT EXISTS transfer_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_storage_location_id UUID NOT NULL,
    to_storage_location_id UUID NOT NULL,
    size_class INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    weight_kg DECIMAL(10,2) NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    requested_by UUID,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transfer_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_storage_location_id UUID,
    to_storage_location_id UUID,
    size_class INTEGER,
    quantity INTEGER,
    weight_grams INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

-- 2. Create Functions
CREATE OR REPLACE FUNCTION create_transfer_request(
    p_from_storage_location_id UUID,
    p_to_storage_location_id UUID,
    p_size INTEGER,
    p_quantity INTEGER,
    p_weight_kg DECIMAL(10,2),
    p_notes TEXT DEFAULT NULL,
    p_requested_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_request_id UUID;
BEGIN
    INSERT INTO transfer_requests (
        from_storage_location_id,
        to_storage_location_id,
        size_class,
        quantity,
        weight_kg,
        notes,
        requested_by
    ) VALUES (
        p_from_storage_location_id,
        p_to_storage_location_id,
        p_size,
        p_quantity,
        p_weight_kg,
        p_notes,
        p_requested_by
    ) RETURNING id INTO v_request_id;
    
    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION approve_transfer_request(
    p_request_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_request RECORD;
BEGIN
    SELECT * INTO v_request
    FROM transfer_requests
    WHERE id = p_request_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer request not found or already processed'::TEXT;
        RETURN;
    END IF;
    
    -- Move ALL fish from source to destination
    UPDATE sorting_results 
    SET storage_location_id = v_request.to_storage_location_id, updated_at = NOW()
    WHERE storage_location_id = v_request.from_storage_location_id;
    
    -- Update storage capacities
    PERFORM update_storage_capacity_from_inventory();
    
    -- Update request status
    UPDATE transfer_requests
    SET status = 'approved', approved_by = p_approved_by, approved_at = NOW(), updated_at = NOW()
    WHERE id = p_request_id;
    
    -- Create transfer log entry
    INSERT INTO transfer_log (
        from_storage_location_id, to_storage_location_id, size_class, quantity, weight_grams, notes
    ) VALUES (
        v_request.from_storage_location_id, v_request.to_storage_location_id, 
        v_request.size_class, v_request.quantity, (v_request.weight_kg * 1000)::INTEGER, 
        COALESCE(v_request.notes, 'Transfer approved and executed')
    );
    
    RETURN QUERY SELECT TRUE, 'Transfer approved and executed successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decline_transfer_request(
    p_request_id UUID,
    p_approved_by UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE transfer_requests
    SET status = 'declined', approved_by = p_approved_by, approved_at = NOW(), updated_at = NOW()
    WHERE id = p_request_id AND status = 'pending';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 3. Disable RLS and Grant Permissions
ALTER TABLE transfer_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_log DISABLE ROW LEVEL SECURITY;

GRANT ALL ON transfer_requests TO authenticated;
GRANT ALL ON transfer_log TO authenticated;
GRANT ALL ON transfer_requests TO anon;
GRANT ALL ON transfer_log TO anon;

GRANT EXECUTE ON FUNCTION create_transfer_request TO authenticated;
GRANT EXECUTE ON FUNCTION approve_transfer_request TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer_request TO authenticated;
GRANT EXECUTE ON FUNCTION create_transfer_request TO anon;
GRANT EXECUTE ON FUNCTION approve_transfer_request TO anon;
GRANT EXECUTE ON FUNCTION decline_transfer_request TO anon;

-- 4. Update storage capacities
SELECT update_storage_capacity_from_inventory();
