-- One SQL script to fix all transfer issues

-- Create transfers table if it doesn't exist
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_created_at ON transfers(created_at);

-- Fix RLS
ALTER TABLE transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

-- Create simple policies
DROP POLICY IF EXISTS "Allow all authenticated users to view transfers" ON transfers;
DROP POLICY IF EXISTS "Allow all authenticated users to insert transfers" ON transfers;
DROP POLICY IF EXISTS "Allow all authenticated users to update transfers" ON transfers;
DROP POLICY IF EXISTS "Allow all authenticated users to delete transfers" ON transfers;

CREATE POLICY "Allow all authenticated users to view transfers" ON transfers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to insert transfers" ON transfers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to update transfers" ON transfers FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to delete transfers" ON transfers FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create functions
DROP FUNCTION IF EXISTS approve_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS decline_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID);

CREATE OR REPLACE FUNCTION approve_transfer(p_transfer_id UUID, p_approved_by UUID)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
BEGIN
    UPDATE transfers SET status = 'approved', approved_by = p_approved_by, approved_at = NOW(), updated_at = NOW()
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF FOUND THEN
        RETURN QUERY SELECT TRUE, 'Transfer approved successfully'::TEXT;
    ELSE
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decline_transfer(p_transfer_id UUID, p_approved_by UUID)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
BEGIN
    UPDATE transfers SET status = 'declined', approved_by = p_approved_by, approved_at = NOW(), updated_at = NOW()
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF FOUND THEN
        RETURN QUERY SELECT TRUE, 'Transfer declined successfully'::TEXT;
    ELSE
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_batch_transfer(p_from_storage_location_id UUID, p_to_storage_location_id UUID, p_size_data JSONB, p_notes TEXT DEFAULT NULL, p_requested_by UUID DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
    v_transfer_id UUID;
    v_first_transfer_id UUID;
    v_size_item JSONB;
    v_from_name TEXT;
    v_to_name TEXT;
BEGIN
    SELECT name INTO v_from_name FROM storage_locations WHERE id = p_from_storage_location_id;
    SELECT name INTO v_to_name FROM storage_locations WHERE id = p_to_storage_location_id;
    
    FOR v_size_item IN SELECT * FROM jsonb_array_elements(p_size_data)
    LOOP
        INSERT INTO transfers (from_storage_location_id, to_storage_location_id, from_storage_name, to_storage_name, size_class, quantity, weight_kg, notes, requested_by, status)
        VALUES (p_from_storage_location_id, p_to_storage_location_id, v_from_name, v_to_name, (v_size_item->>'size')::INTEGER, (v_size_item->>'quantity')::INTEGER, (v_size_item->>'weightKg')::DECIMAL(10,2), p_notes, p_requested_by, 'pending')
        RETURNING id INTO v_transfer_id;
        
        IF v_first_transfer_id IS NULL THEN
            v_first_transfer_id := v_transfer_id;
        END IF;
    END LOOP;
    
    RETURN v_first_transfer_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON transfers TO authenticated;
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID) TO authenticated;

SELECT 'Transfer system fixed!' as status;
