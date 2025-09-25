-- Fix fish_inventory table RLS permissions
-- Run this in Supabase SQL Editor

-- Disable RLS for fish_inventory table
ALTER TABLE fish_inventory DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'fish_inventory' 
AND schemaname = 'public';

-- Check if the table has the required columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'fish_inventory' 
ORDER BY ordinal_position;

-- If ready_for_dispatch column doesn't exist, add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'fish_inventory' 
        AND column_name = 'ready_for_dispatch'
    ) THEN
        ALTER TABLE fish_inventory ADD COLUMN ready_for_dispatch BOOLEAN DEFAULT false;
        RAISE NOTICE 'ready_for_dispatch column added to fish_inventory table';
    ELSE
        RAISE NOTICE 'ready_for_dispatch column already exists in fish_inventory table';
    END IF;
END $$;

-- Update existing records to have ready_for_dispatch = true (for testing)
UPDATE fish_inventory SET ready_for_dispatch = true WHERE ready_for_dispatch IS NULL;

-- Verify the update
SELECT COUNT(*) as total_records, 
       COUNT(CASE WHEN ready_for_dispatch = true THEN 1 END) as ready_for_dispatch_count
FROM fish_inventory;
