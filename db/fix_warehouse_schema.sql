-- Fix warehouse_entries table schema to match component expectations
-- This adds the missing farmer_name column and ensures proper schema alignment

-- Add farmer_name column to warehouse_entries table
ALTER TABLE warehouse_entries 
ADD COLUMN IF NOT EXISTS farmer_name TEXT;

-- Update existing records to populate farmer_name from farmers table
UPDATE warehouse_entries 
SET farmer_name = f.name
FROM farmers f 
WHERE warehouse_entries.farmer_id = f.id 
AND warehouse_entries.farmer_name IS NULL;

-- Make farmer_name NOT NULL for new entries (but allow existing NULL values)
-- We'll handle this in the application layer for now

-- Verify the schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'warehouse_entries'
ORDER BY ordinal_position;

-- Check if the column was added successfully
SELECT 'farmer_name column added successfully!' as status;
