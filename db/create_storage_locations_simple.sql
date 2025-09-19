-- Simple Storage Locations Table Creation
-- Run this in Supabase SQL Editor to fix the 404 error

CREATE TABLE storage_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    location_type TEXT NOT NULL,
    capacity_kg DECIMAL(10,2) NOT NULL,
    current_usage_kg DECIMAL(10,2) DEFAULT 0,
    temperature_celsius DECIMAL(4,2),
    humidity_percent DECIMAL(4,2),
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert some default storage locations
INSERT INTO storage_locations (name, description, location_type, capacity_kg, temperature_celsius, humidity_percent, status) VALUES
('Cold Storage A', 'Primary cold storage unit', 'cold_storage', 2000.00, 2.00, 85.00, 'active'),
('Cold Storage B', 'Secondary cold storage unit', 'cold_storage', 1500.00, 2.00, 85.00, 'active'),
('Freezer Unit 1', 'Deep freeze storage', 'freezer', 1000.00, -18.00, 90.00, 'active'),
('Processing Area 1', 'Main processing area', 'processing_area', 500.00, 15.00, 70.00, 'active'),
('Processing Area 2', 'Secondary processing area', 'processing_area', 500.00, 15.00, 70.00, 'active');

-- Enable Row Level Security
ALTER TABLE storage_locations ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Enable all access for authenticated users" ON storage_locations
    FOR ALL USING (auth.role() = 'authenticated');

-- Verify the table was created
SELECT 'storage_locations table created successfully!' as status;
SELECT COUNT(*) as total_locations FROM storage_locations;
