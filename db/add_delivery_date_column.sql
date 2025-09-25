-- Add delivery_date column to outlet_orders table
-- Run this in Supabase SQL Editor

-- Add delivery_date column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'outlet_orders' 
        AND column_name = 'delivery_date'
    ) THEN
        ALTER TABLE outlet_orders ADD COLUMN delivery_date TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'delivery_date column added to outlet_orders table';
    ELSE
        RAISE NOTICE 'delivery_date column already exists in outlet_orders table';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'outlet_orders' 
AND column_name = 'delivery_date';
