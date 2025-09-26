-- Fix transfer system for transfer_details view
-- This works with transfer_details as a view

-- 1. Create the missing functions for transfer_details view
DROP FUNCTION IF EXISTS create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID);
DROP FUNCTION IF EXISTS approve_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS decline_transfer(UUID, UUID);

-- Create create_batch_transfer function
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
BEGIN
    -- Get storage names
    SELECT name INTO v_from_name FROM storage_locations WHERE id = p_from_storage_location_id;
    SELECT name INTO v_to_name FROM storage_locations WHERE id = p_to_storage_location_id;
    
    -- Try to insert into transfers table (the underlying table)
    FOR v_size_item IN SELECT * FROM jsonb_array_elements(p_size_data)
    LOOP
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
            (v_size_item->>'size')::INTEGER,
            (v_size_item->>'quantity')::INTEGER,
            (v_size_item->>'weightKg')::DECIMAL(10,2),
            p_notes,
            p_requested_by,
            'pending'
        ) RETURNING id INTO v_transfer_id;
        
        -- Store the first transfer ID to return
        IF v_first_transfer_id IS NULL THEN
            v_first_transfer_id := v_transfer_id;
        END IF;
    END LOOP;
    
    RETURN v_first_transfer_id;
END;
$$ LANGUAGE plpgsql;

-- Create approve_transfer function
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
    -- Check in transfers table (the underlying table)
    SELECT * INTO v_transfer
    FROM transfers
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer request not found or already processed'::TEXT;
        RETURN;
    END IF;
    
    -- Update transfer status to approved in transfers table
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

-- Create decline_transfer function
CREATE OR REPLACE FUNCTION decline_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
BEGIN
    -- Update in transfers table (the underlying table)
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

-- 2. Grant permissions on functions
GRANT EXECUTE ON FUNCTION create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO authenticated;

-- 3. Grant permissions on transfers table (the underlying table)
GRANT ALL ON transfers TO authenticated;

-- 4. Fix RLS on transfers table (the underlying table)
ALTER TABLE transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

-- Create simple policies on transfers table
DROP POLICY IF EXISTS "Allow all authenticated users to view transfers" ON transfers;
DROP POLICY IF EXISTS "Allow all authenticated users to insert transfers" ON transfers;
DROP POLICY IF EXISTS "Allow all authenticated users to update transfers" ON transfers;
DROP POLICY IF EXISTS "Allow all authenticated users to delete transfers" ON transfers;

CREATE POLICY "Allow all authenticated users to view transfers" ON transfers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to insert transfers" ON transfers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to update transfers" ON transfers FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to delete transfers" ON transfers FOR DELETE USING (auth.uid() IS NOT NULL);

SELECT 'Transfer system fixed! Using transfers table with transfer_details view.' as status;
