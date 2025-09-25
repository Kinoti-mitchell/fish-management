-- Test Storage Locations Table
-- Run this to verify the table exists and has data

-- Check if table exists
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'storage_locations'
ORDER BY ordinal_position;

-- Check row count
SELECT COUNT(*) as total_locations FROM storage_locations;

-- Show all storage locations
SELECT 
    id,
    name,
    location_type,
    capacity_kg,
    current_usage_kg,
    temperature_celsius,
    humidity_percent,
    status,
    created_at
FROM storage_locations 
ORDER BY name;

-- Test a simple query that matches what the frontend does
SELECT * FROM storage_locations ORDER BY name;
