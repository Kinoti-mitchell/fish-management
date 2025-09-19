-- Add sample data with temperature values for dashboard testing
-- This will provide meaningful data for the temperature and fish size analysis

-- First, let's add temperature data to existing warehouse entries if they don't have it
UPDATE warehouse_entries 
SET temperature = CASE 
    WHEN fish_type = 'Nile Tilapia' THEN 22.5
    WHEN fish_type = 'Nile Perch' THEN 20.0
    WHEN fish_type = 'Silver Cyprinid' THEN 24.0
    ELSE 22.0
END
WHERE temperature IS NULL;

-- Add more sample warehouse entries with temperature data
INSERT INTO warehouse_entries (
    entry_date, 
    total_weight, 
    total_pieces, 
    fish_type, 
    condition, 
    temperature,
    farmer_id, 
    price_per_kg, 
    total_value, 
    notes
) VALUES 
    (CURRENT_DATE - INTERVAL '1 day', 30.0, 60, 'Nile Tilapia', 'excellent', 23.5, 
     (SELECT id FROM farmers LIMIT 1), 16.0, 480.0, 'Fresh tilapia with good temperature'),
    (CURRENT_DATE - INTERVAL '2 days', 40.0, 25, 'Nile Perch', 'good', 19.5, 
     (SELECT id FROM farmers LIMIT 1), 26.0, 1040.0, 'Large perch batch - cool storage'),
    (CURRENT_DATE - INTERVAL '3 days', 20.0, 80, 'Silver Cyprinid', 'excellent', 25.0, 
     (SELECT id FROM farmers LIMIT 1), 13.0, 260.0, 'Small fish - warm water species'),
    (CURRENT_DATE - INTERVAL '4 days', 35.0, 45, 'Nile Tilapia', 'good', 21.0, 
     (SELECT id FROM farmers LIMIT 1), 15.5, 542.5, 'Medium tilapia batch'),
    (CURRENT_DATE - INTERVAL '5 days', 50.0, 20, 'Nile Perch', 'excellent', 18.5, 
     (SELECT id FROM farmers LIMIT 1), 28.0, 1400.0, 'Premium perch - optimal temperature')
ON CONFLICT DO NOTHING;

-- Verify the data
SELECT 
    'Sample data added successfully' as status,
    COUNT(*) as total_entries,
    COUNT(temperature) as entries_with_temperature,
    AVG(temperature) as average_temperature,
    SUM(total_weight) as total_weight,
    AVG(total_weight / total_pieces) as avg_fish_size
FROM warehouse_entries;

-- Show sample of the data
SELECT 
    entry_date,
    fish_type,
    total_weight,
    total_pieces,
    temperature,
    ROUND(total_weight / total_pieces, 2) as avg_fish_size_kg
FROM warehouse_entries 
WHERE temperature IS NOT NULL
ORDER BY entry_date DESC
LIMIT 10;
