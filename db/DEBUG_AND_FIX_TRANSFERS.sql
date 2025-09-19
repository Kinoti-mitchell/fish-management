-- Debug and Fix Transfer System
-- This script will check what exists and create a working transfer system

-- 1. Check what tables currently exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%transfer%'
ORDER BY table_name;

-- 2. Check if transfers table exists and its structure
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transfers') THEN
        RAISE NOTICE 'transfers table exists';
        -- Show table structure
        PERFORM * FROM transfers LIMIT 0;
    ELSE
        RAISE NOTICE 'transfers table does not exist - creating it';
    END IF;
END $$;

-- 3. Create the transfers table if it doesn't exist
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

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_from_storage ON transfers(from_storage_location_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_storage ON transfers(to_storage_location_id);
CREATE INDEX IF NOT EXISTS idx_transfers_created_at ON transfers(created_at);

-- 5. Disable RLS and grant permissions
ALTER TABLE transfers DISABLE ROW LEVEL SECURITY;

GRANT ALL ON transfers TO authenticated;
GRANT ALL ON transfers TO anon;

-- 6. Create or replace functions
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

CREATE OR REPLACE FUNCTION approve_transfer(
    p_transfer_id UUID,
    p_approved_by TEXT
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transfer RECORD;
    v_approved_by_uuid UUID;
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
    
    -- Update transfer status to completed
    UPDATE transfers
    SET status = 'completed', 
        approved_by = v_approved_by_uuid, 
        approved_at = NOW(), 
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id;
    
    RETURN QUERY SELECT TRUE, 'Transfer approved and completed successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decline_transfer(
    p_transfer_id UUID,
    p_approved_by TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_approved_by_uuid UUID;
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
    
    UPDATE transfers
    SET status = 'declined', 
        approved_by = v_approved_by_uuid, 
        approved_at = NOW(), 
        updated_at = NOW()
    WHERE id = p_transfer_id AND status = 'pending';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 7. Grant function permissions
GRANT EXECUTE ON FUNCTION create_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION approve_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION create_transfer TO anon;
GRANT EXECUTE ON FUNCTION approve_transfer TO anon;
GRANT EXECUTE ON FUNCTION decline_transfer TO anon;

-- 8. Insert some test data to verify the system works
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
) VALUES 
(
    '5cc7c667-8959-4dde-abe8-bd41d2b26d4e', -- Cold Storage A
    'f0f53658-830a-45c2-8dd3-4d0639e408d0', -- Cold Storage B
    'Cold Storage A',
    'Cold Storage B',
    5,
    100,
    75.5,
    'Test transfer for system verification',
    'completed'
),
(
    'cfb34d85-6120-42fa-9af9-945d7d235ebc', -- Test Storage
    '0714e394-2396-438b-bcbe-9701633ff5ac', -- Freezer Unit 1
    'Test Storage',
    'Freezer Unit 1',
    3,
    50,
    25.0,
    'Another test transfer',
    'pending'
);

-- 9. Verify the data was inserted
SELECT 
    id,
    from_storage_name,
    to_storage_name,
    size_class,
    quantity,
    weight_kg,
    status,
    created_at
FROM transfers
ORDER BY created_at DESC;

-- 10. Check if storage_locations table exists and has data
SELECT COUNT(*) as storage_count FROM storage_locations;
SELECT id, name FROM storage_locations LIMIT 5;
