-- Create Missing Database Tables
-- Run this in Supabase SQL Editor

-- Create outlets table
CREATE TABLE IF NOT EXISTS outlets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create outlet_orders table
CREATE TABLE IF NOT EXISTS outlet_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivery_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled')),
    total_value DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES outlet_orders(id) ON DELETE CASCADE,
    fish_type TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create warehouse_entries table
CREATE TABLE IF NOT EXISTS warehouse_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fish_type TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_weight DECIMAL(10,2),
    total_weight DECIMAL(10,2),
    source TEXT,
    quality_grade TEXT,
    entry_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    received_by UUID REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create processing_records table
CREATE TABLE IF NOT EXISTS processing_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fish_type TEXT NOT NULL,
    input_quantity DECIMAL(10,2) NOT NULL,
    output_quantity DECIMAL(10,2) NOT NULL,
    processing_type TEXT NOT NULL,
    processing_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_by UUID REFERENCES profiles(id),
    quality_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create dispatch_records table
CREATE TABLE IF NOT EXISTS dispatch_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES outlet_orders(id),
    dispatch_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    vehicle_info TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    status TEXT DEFAULT 'dispatched' CHECK (status IN ('dispatched', 'in_transit', 'delivered')),
    notes TEXT,
    dispatched_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create fish_inventory table
CREATE TABLE IF NOT EXISTS fish_inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fish_type TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit_weight DECIMAL(10,2),
    total_weight DECIMAL(10,2),
    location TEXT,
    quality_grade TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_sessions table (if not exists)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL,
    user_agent TEXT,
    device_type TEXT,
    is_active BOOLEAN DEFAULT true,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample data
INSERT INTO outlets (name, location, contact_person, phone, email, address) VALUES
('Main Outlet', 'Nairobi', 'John Doe', '+254700000001', 'main@riofish.com', 'Nairobi CBD'),
('Coast Outlet', 'Mombasa', 'Jane Smith', '+254700000002', 'coast@riofish.com', 'Mombasa Port'),
('Rift Valley Outlet', 'Nakuru', 'Mike Johnson', '+254700000003', 'rift@riofish.com', 'Nakuru Town')
ON CONFLICT DO NOTHING;

-- Disable RLS temporarily for testing
ALTER TABLE outlets DISABLE ROW LEVEL SECURITY;
ALTER TABLE outlet_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE processing_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE fish_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY;

-- Verify tables created
SELECT 'Missing tables created successfully!' as status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
