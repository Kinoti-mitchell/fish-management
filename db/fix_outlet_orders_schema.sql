-- Fix outlet_orders table schema to unify the two different schemas
-- Run this in Supabase SQL Editor

-- First, check current outlet_orders table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'outlet_orders'
ORDER BY ordinal_position;

-- Create or update outlet_orders table with unified schema
CREATE TABLE IF NOT EXISTS outlet_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivery_date TIMESTAMP WITH TIME ZONE,
    requested_sizes INTEGER[],
    requested_quantity INTEGER,
    requested_grade TEXT CHECK (requested_grade IN ('A', 'B', 'C', 'any')),
    price_per_kg DECIMAL(10,2),
    total_value DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled')),
    confirmed_date TIMESTAMP WITH TIME ZONE,
    dispatch_date TIMESTAMP WITH TIME ZONE,
    completed_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add requested_sizes column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'outlet_orders' 
        AND column_name = 'requested_sizes'
    ) THEN
        ALTER TABLE outlet_orders ADD COLUMN requested_sizes INTEGER[];
    END IF;

    -- Add requested_quantity column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'outlet_orders' 
        AND column_name = 'requested_quantity'
    ) THEN
        ALTER TABLE outlet_orders ADD COLUMN requested_quantity INTEGER;
    END IF;

    -- Add requested_grade column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'outlet_orders' 
        AND column_name = 'requested_grade'
    ) THEN
        ALTER TABLE outlet_orders ADD COLUMN requested_grade TEXT CHECK (requested_grade IN ('A', 'B', 'C', 'any'));
    END IF;

    -- Add price_per_kg column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'outlet_orders' 
        AND column_name = 'price_per_kg'
    ) THEN
        ALTER TABLE outlet_orders ADD COLUMN price_per_kg DECIMAL(10,2);
    END IF;

    -- Add delivery_date column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'outlet_orders' 
        AND column_name = 'delivery_date'
    ) THEN
        ALTER TABLE outlet_orders ADD COLUMN delivery_date TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add confirmed_date column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'outlet_orders' 
        AND column_name = 'confirmed_date'
    ) THEN
        ALTER TABLE outlet_orders ADD COLUMN confirmed_date TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add dispatch_date column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'outlet_orders' 
        AND column_name = 'dispatch_date'
    ) THEN
        ALTER TABLE outlet_orders ADD COLUMN dispatch_date TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add completed_date column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'outlet_orders' 
        AND column_name = 'completed_date'
    ) THEN
        ALTER TABLE outlet_orders ADD COLUMN completed_date TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add created_by column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'outlet_orders' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE outlet_orders ADD COLUMN created_by UUID REFERENCES profiles(id);
    END IF;
END $$;

-- Create order_items table if it doesn't exist
CREATE TABLE IF NOT EXISTS order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES outlet_orders(id) ON DELETE CASCADE,
    fish_type TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS temporarily for testing
ALTER TABLE outlet_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- Insert some sample outlet orders if the table is empty
INSERT INTO outlet_orders (
    outlet_id, 
    requested_sizes, 
    requested_quantity, 
    requested_grade, 
    price_per_kg, 
    total_value, 
    status, 
    notes
) 
SELECT 
    o.id,
    ARRAY[2, 3, 4],
    100,
    'A',
    450.00,
    45000.00,
    'pending',
    'Sample order for testing'
FROM outlets o 
WHERE o.name = 'Main Outlet'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'outlet_orders'
ORDER BY ordinal_position;

-- Show sample data
SELECT 
    oo.*,
    o.name as outlet_name,
    o.location as outlet_location,
    o.phone as outlet_phone
FROM outlet_orders oo
LEFT JOIN outlets o ON oo.outlet_id = o.id
LIMIT 5;
