-- Setup transfer system to use transfer_details table
-- This creates all the functions your code needs

-- 1. Create the missing functions for transfer_details table
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
    
    -- Create transfer_details for each size
    FOR v_size_item IN SELECT * FROM jsonb_array_elements(p_size_data)
    LOOP
        INSERT INTO transfer_details (
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
    SELECT * INTO v_transfer
    FROM transfer_details
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer request not found or already processed'::TEXT;
        RETURN;
    END IF;
    
    -- Update transfer status to approved
    UPDATE transfer_details
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
    UPDATE transfer_details
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

-- 2. Fix RLS on transfer_details table
ALTER TABLE transfer_details DISABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_details ENABLE ROW LEVEL SECURITY;

-- Create simple policies
DROP POLICY IF EXISTS "Allow all authenticated users to view transfer_details" ON transfer_details;
DROP POLICY IF EXISTS "Allow all authenticated users to insert transfer_details" ON transfer_details;
DROP POLICY IF EXISTS "Allow all authenticated users to update transfer_details" ON transfer_details;
DROP POLICY IF EXISTS "Allow all authenticated users to delete transfer_details" ON transfer_details;

CREATE POLICY "Allow all authenticated users to view transfer_details" ON transfer_details FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to insert transfer_details" ON transfer_details FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to update transfer_details" ON transfer_details FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to delete transfer_details" ON transfer_details FOR DELETE USING (auth.uid() IS NOT NULL);

-- 3. Grant permissions
GRANT ALL ON transfer_details TO authenticated;
GRANT EXECUTE ON FUNCTION create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO authenticated;

-- 4. Add missing columns if they don't exist
DO $$
BEGIN
    -- Add approved_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfer_details' AND column_name = 'approved_by') THEN
        ALTER TABLE transfer_details ADD COLUMN approved_by UUID;
    END IF;
    
    -- Add approved_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfer_details' AND column_name = 'approved_at') THEN
        ALTER TABLE transfer_details ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add from_storage_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfer_details' AND column_name = 'from_storage_name') THEN
        ALTER TABLE transfer_details ADD COLUMN from_storage_name TEXT;
    END IF;
    
    -- Add to_storage_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfer_details' AND column_name = 'to_storage_name') THEN
        ALTER TABLE transfer_details ADD COLUMN to_storage_name TEXT;
    END IF;
END $$;

SELECT 'Transfer system setup complete! Using transfer_details table.' as status;
