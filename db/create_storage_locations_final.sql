-- Create Storage Locations Table
-- Run this in your Supabase SQL Editor to fix the 404 error

-- Create storage_locations table
CREATE TABLE IF NOT EXISTS storage_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    location_type TEXT NOT NULL CHECK (location_type IN ('cold_storage', 'freezer', 'ambient', 'processing_area')),
    capacity_kg DECIMAL(10,2) NOT NULL,
    current_usage_kg DECIMAL(10,2) DEFAULT 0,
    temperature_celsius DECIMAL(4,2),
    humidity_percent DECIMAL(4,2),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_storage_locations_name ON storage_locations(name);
CREATE INDEX IF NOT EXISTS idx_storage_locations_status ON storage_locations(status);
CREATE INDEX IF NOT EXISTS idx_storage_locations_type ON storage_locations(location_type);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_storage_locations_updated_at ON storage_locations;
CREATE TRIGGER update_storage_locations_updated_at 
    BEFORE UPDATE ON storage_locations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default storage locations
INSERT INTO storage_locations (name, description, location_type, capacity_kg, temperature_celsius, humidity_percent, status) VALUES
('Cold Storage A', 'Primary cold storage unit for processed fish', 'cold_storage', 2000.00, 2.00, 85.00, 'active'),
('Cold Storage B', 'Secondary cold storage unit', 'cold_storage', 1500.00, 2.00, 85.00, 'active'),
('Freezer Unit 1', 'Deep freeze storage for long-term storage', 'freezer', 1000.00, -18.00, 90.00, 'active'),
('Processing Area 1', 'Main processing area for fish preparation', 'processing_area', 500.00, 15.00, 70.00, 'active'),
('Processing Area 2', 'Secondary processing area', 'processing_area', 500.00, 15.00, 70.00, 'active')
ON CONFLICT (name) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE storage_locations ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Enable all access for authenticated users" ON storage_locations
    FOR ALL USING (auth.role() = 'authenticated');

-- Verify the table was created successfully
SELECT 'storage_locations table created successfully!' as status;
SELECT COUNT(*) as total_locations FROM storage_locations;
