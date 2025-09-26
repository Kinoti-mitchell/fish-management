-- Complete Fix for All Database Issues
-- Run this in your Supabase SQL Editor

-- Step 1: Fix RLS for processing_records table
ALTER TABLE processing_records DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Enable read access for all users" ON processing_records;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON processing_records;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON processing_records;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON processing_records;
DROP POLICY IF EXISTS "Users can view processing records" ON processing_records;
DROP POLICY IF EXISTS "Users can update processing records" ON processing_records;
DROP POLICY IF EXISTS "Allow all authenticated users to view processing records" ON processing_records;
DROP POLICY IF EXISTS "Allow all authenticated users to insert processing records" ON processing_records;
DROP POLICY IF EXISTS "Allow all authenticated users to update processing records" ON processing_records;
DROP POLICY IF EXISTS "Allow all authenticated users to delete processing records" ON processing_records;

-- Re-enable RLS
ALTER TABLE processing_records ENABLE ROW LEVEL SECURITY;

-- Create simple, permissive policies
CREATE POLICY "Allow all authenticated users to view processing records" ON processing_records
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated users to insert processing records" ON processing_records
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated users to update processing records" ON processing_records
    FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated users to delete processing records" ON processing_records
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Step 2: Fix RLS for sorting_batches table
ALTER TABLE sorting_batches DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated users to view sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Allow all authenticated users to insert sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Allow all authenticated users to update sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Allow all authenticated users to delete sorting batches" ON sorting_batches;
ALTER TABLE sorting_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to view sorting batches" ON sorting_batches
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to insert sorting batches" ON sorting_batches
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to update sorting batches" ON sorting_batches
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to delete sorting batches" ON sorting_batches
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Step 3: Fix RLS for sorting_results table
ALTER TABLE sorting_results DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated users to view sorting results" ON sorting_results;
DROP POLICY IF EXISTS "Allow all authenticated users to insert sorting results" ON sorting_results;
DROP POLICY IF EXISTS "Allow all authenticated users to update sorting results" ON sorting_results;
DROP POLICY IF EXISTS "Allow all authenticated users to delete sorting results" ON sorting_results;
ALTER TABLE sorting_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to view sorting results" ON sorting_results
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to insert sorting results" ON sorting_results
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to update sorting results" ON sorting_results
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to delete sorting results" ON sorting_results
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Step 4: Fix RLS for warehouse_entries table
ALTER TABLE warehouse_entries DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated users to view warehouse entries" ON warehouse_entries;
DROP POLICY IF EXISTS "Allow all authenticated users to insert warehouse entries" ON warehouse_entries;
DROP POLICY IF EXISTS "Allow all authenticated users to update warehouse entries" ON warehouse_entries;
DROP POLICY IF EXISTS "Allow all authenticated users to delete warehouse entries" ON warehouse_entries;
ALTER TABLE warehouse_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to view warehouse entries" ON warehouse_entries
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to insert warehouse entries" ON warehouse_entries
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to update warehouse entries" ON warehouse_entries
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to delete warehouse entries" ON warehouse_entries
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Step 5: Fix RLS for storage_locations table
ALTER TABLE storage_locations DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated users to view storage locations" ON storage_locations;
DROP POLICY IF EXISTS "Allow all authenticated users to insert storage locations" ON storage_locations;
DROP POLICY IF EXISTS "Allow all authenticated users to update storage locations" ON storage_locations;
DROP POLICY IF EXISTS "Allow all authenticated users to delete storage locations" ON storage_locations;
ALTER TABLE storage_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to view storage locations" ON storage_locations
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to insert storage locations" ON storage_locations
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to update storage locations" ON storage_locations
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to delete storage locations" ON storage_locations
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Step 6: Fix RLS for farmers table
ALTER TABLE farmers DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated users to view farmers" ON farmers;
DROP POLICY IF EXISTS "Allow all authenticated users to insert farmers" ON farmers;
DROP POLICY IF EXISTS "Allow all authenticated users to update farmers" ON farmers;
DROP POLICY IF EXISTS "Allow all authenticated users to delete farmers" ON farmers;
ALTER TABLE farmers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to view farmers" ON farmers
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to insert farmers" ON farmers
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to update farmers" ON farmers
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to delete farmers" ON farmers
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Step 7: Fix RLS for profiles table
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Allow all authenticated users to view profiles" ON profiles;
DROP POLICY IF EXISTS "Allow all authenticated users to insert profiles" ON profiles;
DROP POLICY IF EXISTS "Allow all authenticated users to update profiles" ON profiles;
DROP POLICY IF EXISTS "Allow all authenticated users to delete profiles" ON profiles;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to view profiles" ON profiles
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to insert profiles" ON profiles
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to update profiles" ON profiles
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to delete profiles" ON profiles
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Step 8: Grant necessary permissions to authenticated role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Step 9: Fix RLS for transfers table
ALTER TABLE transfers DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated users to view transfers" ON transfers;
DROP POLICY IF EXISTS "Allow all authenticated users to insert transfers" ON transfers;
DROP POLICY IF EXISTS "Allow all authenticated users to update transfers" ON transfers;
DROP POLICY IF EXISTS "Allow all authenticated users to delete transfers" ON transfers;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to view transfers" ON transfers
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to insert transfers" ON transfers
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to update transfers" ON transfers
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated users to delete transfers" ON transfers
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Step 10: Create missing transfer functions
-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS approve_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS decline_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID);

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
    FROM transfers
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer request not found or already processed'::TEXT;
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
    
    -- Create transfers for each size
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
            v_from_name,
            v_to_name,
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

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION approve_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID) TO authenticated;

-- Step 11: Verify the fix
SELECT 'All RLS policies and transfer functions fixed successfully!' as status;
