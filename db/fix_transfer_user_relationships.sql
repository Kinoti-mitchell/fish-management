-- Fix Transfer User Relationships
-- This script adds foreign key relationships between transfers and users tables

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

-- Add foreign key constraints
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
