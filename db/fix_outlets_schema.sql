-- Fix outlets table schema to match UserManagement component expectations
-- Run this in Supabase SQL Editor

-- First, check if outlets table exists and what columns it has
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'outlets'
ORDER BY ordinal_position;

-- If the table doesn't exist, create it with the correct schema
CREATE TABLE IF NOT EXISTS outlets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    phone TEXT NOT NULL,
    manager_name TEXT,
    manager_id UUID REFERENCES profiles(id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- If the table exists but has wrong columns, add missing columns
DO $$ 
BEGIN
    -- Add manager_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'outlets' 
        AND column_name = 'manager_name'
    ) THEN
        ALTER TABLE outlets ADD COLUMN manager_name TEXT;
    END IF;

    -- Add manager_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'outlets' 
        AND column_name = 'manager_id'
    ) THEN
        ALTER TABLE outlets ADD COLUMN manager_id UUID REFERENCES profiles(id);
    END IF;

    -- Add status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'outlets' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE outlets ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;

-- Disable RLS temporarily for testing
ALTER TABLE outlets DISABLE ROW LEVEL SECURITY;

-- Insert some sample data if the table is empty
INSERT INTO outlets (name, location, phone, manager_name, status) VALUES
('Main Outlet', 'Nairobi CBD', '+254700000001', 'John Doe', 'active'),
('Coast Outlet', 'Mombasa Port', '+254700000002', 'Jane Smith', 'active'),
('Rift Valley Outlet', 'Nakuru Town', '+254700000003', 'Mike Johnson', 'active')
ON CONFLICT DO NOTHING;

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'outlets'
ORDER BY ordinal_position;

-- Show sample data
SELECT * FROM outlets LIMIT 5;
