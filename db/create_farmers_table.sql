-- Create Farmers Table and Sample Data
-- Run this in Supabase SQL Editor

-- Create farmers table
CREATE TABLE IF NOT EXISTS farmers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    location VARCHAR(200) NOT NULL,
    rating DECIMAL(3,2) DEFAULT 0.0,
    reliability VARCHAR(20) DEFAULT 'fair',
    status VARCHAR(20) DEFAULT 'active',
    average_fish_size DECIMAL(4,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample farmers
INSERT INTO farmers (name, phone, location, rating, reliability, status) VALUES
('John Mwangi', '+254700000001', 'Kisumu', 4.5, 'excellent', 'active'),
('Mary Wanjiku', '+254700000002', 'Mombasa', 4.2, 'good', 'active'),
('Peter Otieno', '+254700000003', 'Nakuru', 3.8, 'fair', 'active'),
('Grace Akinyi', '+254700000004', 'Eldoret', 4.0, 'good', 'active'),
('David Kimani', '+254700000005', 'Nairobi', 4.3, 'excellent', 'active'),
('Sarah Muthoni', '+254700000006', 'Thika', 3.9, 'good', 'active'),
('James Kiprop', '+254700000007', 'Kericho', 4.1, 'good', 'active'),
('Esther Wanjala', '+254700000008', 'Kakamega', 3.7, 'fair', 'active'),
('Michael Ochieng', '+254700000009', 'Siaya', 4.4, 'excellent', 'active'),
('Ruth Adhiambo', '+254700000010', 'Homa Bay', 3.6, 'fair', 'active')
ON CONFLICT DO NOTHING;

-- Disable RLS for testing
ALTER TABLE farmers DISABLE ROW LEVEL SECURITY;

-- Verify farmers table
SELECT 'Farmers table created successfully!' as status;
SELECT COUNT(*) as total_farmers FROM farmers;
SELECT name, location, rating, reliability, status FROM farmers ORDER BY rating DESC;
