-- Fix Transfer User Relationships (Version 2)
-- This script adds foreign key relationships between transfers and users tables
-- and handles existing functions properly

-- First, let's check if the users table exists and has the right structure
-- If not, we'll create it

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraints to transfers table
-- First, drop existing constraints if they exist
ALTER TABLE transfers DROP CONSTRAINT IF EXISTS transfers_requested_by_fkey;
ALTER TABLE transfers DROP CONSTRAINT IF EXISTS transfers_approved_by_fkey;

-- Add foreign key constraints with proper error handling
-- First, let's add the user IDs that are currently in the transfers table to the users table
INSERT INTO users (id, email, name) 
SELECT DISTINCT requested_by, 'user-' || requested_by || '@riofish.com', 'User ' || SUBSTRING(requested_by::text, 1, 8)
FROM transfers 
WHERE requested_by IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = transfers.requested_by);

INSERT INTO users (id, email, name) 
SELECT DISTINCT approved_by, 'user-' || approved_by || '@riofish.com', 'User ' || SUBSTRING(approved_by::text, 1, 8)
FROM transfers 
WHERE approved_by IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = transfers.approved_by);

-- Now add the foreign key constraints
ALTER TABLE transfers 
ADD CONSTRAINT transfers_requested_by_fkey 
FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE transfers 
ADD CONSTRAINT transfers_approved_by_fkey 
FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transfers_requested_by ON transfers(requested_by);
CREATE INDEX IF NOT EXISTS idx_transfers_approved_by ON transfers(approved_by);

-- Update any existing transfers that have invalid user references
-- Set requested_by to NULL if the user doesn't exist
UPDATE transfers 
SET requested_by = NULL 
WHERE requested_by IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = transfers.requested_by);

-- Set approved_by to NULL if the user doesn't exist
UPDATE transfers 
SET approved_by = NULL 
WHERE approved_by IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = transfers.approved_by);

-- Add some sample users if the table is empty (for testing)
INSERT INTO users (id, email, name) 
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'admin@riofish.com', 'Admin User'),
    ('00000000-0000-0000-0000-000000000002', 'manager@riofish.com', 'Manager User'),
    ('00000000-0000-0000-0000-000000000003', 'worker@riofish.com', 'Worker User')
ON CONFLICT (email) DO NOTHING;

-- Handle existing decline_transfer function if it exists
-- Drop the existing function first if it has a different signature
DROP FUNCTION IF EXISTS decline_transfer(uuid, uuid);

-- Create the decline_transfer function with proper return type
CREATE OR REPLACE FUNCTION decline_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Update the transfer status to declined
    UPDATE transfers 
    SET 
        status = 'declined',
        approved_by = p_approved_by,
        approved_at = NOW()
    WHERE id = p_transfer_id;
    
    -- Check if the update was successful
    IF FOUND THEN
        v_result := json_build_object(
            'success', true,
            'message', 'Transfer declined successfully',
            'transfer_id', p_transfer_id
        );
    ELSE
        v_result := json_build_object(
            'success', false,
            'message', 'Transfer not found',
            'transfer_id', p_transfer_id
        );
    END IF;
    
    RETURN v_result;
END;
$$;

-- Verify the relationships are working
SELECT 
    t.id,
    t.from_storage_name,
    t.to_storage_name,
    t.status,
    t.requested_by,
    u.name as requested_by_name,
    u.email as requested_by_email
FROM transfers t
LEFT JOIN users u ON t.requested_by = u.id
LIMIT 5;
