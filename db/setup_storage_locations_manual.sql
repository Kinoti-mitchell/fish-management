-- Manual Setup for Storage Locations Table
-- Run this in your Supabase SQL Editor

-- Create storage_locations table
CREATE TABLE IF NOT EXISTS storage_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    capacity_kg DECIMAL(10,2) NOT NULL DEFAULT 1000.00,
    current_usage_kg DECIMAL(10,2) DEFAULT 0.00,
    temperature_celsius DECIMAL(4,2) DEFAULT 4.00,
    humidity_percent DECIMAL(5,2) DEFAULT 85.00,
    location_type VARCHAR(50) DEFAULT 'cold_storage' CHECK (location_type IN ('cold_storage', 'freezer', 'ambient', 'processing_area')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_storage_locations_name ON storage_locations(name);
CREATE INDEX IF NOT EXISTS idx_storage_locations_status ON storage_locations(status);
CREATE INDEX IF NOT EXISTS idx_storage_locations_type ON storage_locations(location_type);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_storage_locations_updated_at ON storage_locations;
CREATE TRIGGER update_storage_locations_updated_at 
    BEFORE UPDATE ON storage_locations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default storage locations
INSERT INTO storage_locations (name, description, capacity_kg, location_type) VALUES
('Cold Storage A', 'Primary cold storage unit for processed fish', 2000.00, 'cold_storage'),
('Cold Storage B', 'Secondary cold storage unit', 1500.00, 'cold_storage'),
('Freezer Unit 1', 'Deep freeze storage for long-term storage', 1000.00, 'freezer'),
('Processing Area 1', 'Temporary storage during processing', 500.00, 'processing_area'),
('Processing Area 2', 'Secondary processing area storage', 500.00, 'processing_area')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS (Row Level Security)
ALTER TABLE storage_locations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for all users" ON storage_locations
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON storage_locations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON storage_locations
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON storage_locations
    FOR DELETE USING (auth.role() = 'authenticated');

-- Verify table creation
SELECT 'storage_locations table created successfully!' as status;
SELECT name, capacity_kg, location_type, status FROM storage_locations ORDER BY name;
