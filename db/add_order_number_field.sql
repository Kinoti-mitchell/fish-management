-- Add order_number field to outlet_orders table for organized order IDs
-- Run this in Supabase SQL Editor

-- Add order_number column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'outlet_orders'
        AND column_name = 'order_number'
    ) THEN
        ALTER TABLE outlet_orders ADD COLUMN order_number TEXT UNIQUE;
        RAISE NOTICE 'order_number column added to outlet_orders table';
    ELSE
        RAISE NOTICE 'order_number column already exists in outlet_orders table';
    END IF;
END $$;

-- Add assigned_driver column if it doesn't exist (for dispatch management)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'outlet_orders'
        AND column_name = 'assigned_driver'
    ) THEN
        ALTER TABLE outlet_orders ADD COLUMN assigned_driver TEXT;
        RAISE NOTICE 'assigned_driver column added to outlet_orders table';
    ELSE
        RAISE NOTICE 'assigned_driver column already exists in outlet_orders table';
    END IF;
END $$;

-- Add assigned_date column if it doesn't exist (for dispatch management)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'outlet_orders'
        AND column_name = 'assigned_date'
    ) THEN
        ALTER TABLE outlet_orders ADD COLUMN assigned_date DATE;
        RAISE NOTICE 'assigned_date column added to outlet_orders table';
    ELSE
        RAISE NOTICE 'assigned_date column already exists in outlet_orders table';
    END IF;
END $$;
