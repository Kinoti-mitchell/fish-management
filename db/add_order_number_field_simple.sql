-- Add order_number field to outlet_orders table for organized order IDs
-- Run this in Supabase SQL Editor

-- Add order_number column if it doesn't exist
ALTER TABLE outlet_orders ADD COLUMN IF NOT EXISTS order_number TEXT UNIQUE;

-- Add assigned_driver column if it doesn't exist (for dispatch management)
ALTER TABLE outlet_orders ADD COLUMN IF NOT EXISTS assigned_driver TEXT;

-- Add assigned_date column if it doesn't exist (for dispatch management)
ALTER TABLE outlet_orders ADD COLUMN IF NOT EXISTS assigned_date DATE;
