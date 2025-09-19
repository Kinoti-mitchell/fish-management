-- Disable RLS for Transfer Tables
-- This script disables Row Level Security for transfer-related tables

-- Step 1: Disable RLS on transfer_requests table
ALTER TABLE transfer_requests DISABLE ROW LEVEL SECURITY;

-- Step 2: Disable RLS on transfer_log table (if it exists)
ALTER TABLE transfer_log DISABLE ROW LEVEL SECURITY;

-- Step 3: Grant all permissions to authenticated users
GRANT ALL ON transfer_requests TO authenticated;
GRANT ALL ON transfer_log TO authenticated;

-- Step 4: Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;

-- Step 5: Grant execute permissions on transfer functions
GRANT EXECUTE ON FUNCTION transfer_inventory_between_storage TO authenticated;
GRANT EXECUTE ON FUNCTION create_transfer_request TO authenticated;
GRANT EXECUTE ON FUNCTION approve_transfer_request TO authenticated;
GRANT EXECUTE ON FUNCTION decline_transfer_request TO authenticated;

-- Step 6: Grant permissions to anon users (if needed)
GRANT ALL ON transfer_requests TO anon;
GRANT ALL ON transfer_log TO anon;
GRANT EXECUTE ON FUNCTION transfer_inventory_between_storage TO anon;
GRANT EXECUTE ON FUNCTION create_transfer_request TO anon;
GRANT EXECUTE ON FUNCTION approve_transfer_request TO anon;
GRANT EXECUTE ON FUNCTION decline_transfer_request TO anon;

-- Step 7: Create the tables if they don't exist
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

-- Step 8: Disable RLS again (in case tables were just created)
ALTER TABLE transfer_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_log DISABLE ROW LEVEL SECURITY;

-- Step 9: Final permission grants
GRANT ALL ON transfer_requests TO authenticated;
GRANT ALL ON transfer_log TO authenticated;
GRANT ALL ON transfer_requests TO anon;
GRANT ALL ON transfer_log TO anon;
