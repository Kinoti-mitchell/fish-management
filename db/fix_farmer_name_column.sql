-- Fix farmer_name column in warehouse_entries table
-- This script safely handles the existing farmer_name column and ensures data is populated

-- Check if farmer_name column exists and its current state
DO $$
BEGIN
    -- Check if the column exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'warehouse_entries' 
        AND column_name = 'farmer_name'
    ) THEN
        RAISE NOTICE 'farmer_name column already exists in warehouse_entries table';
    ELSE
        -- Add the column if it doesn't exist
        ALTER TABLE warehouse_entries 
        ADD COLUMN farmer_name TEXT;
        RAISE NOTICE 'farmer_name column added to warehouse_entries table';
    END IF;
END $$;

-- Update existing records to populate farmer_name from farmers table
-- This will only update records where farmer_name is NULL
UPDATE warehouse_entries 
SET farmer_name = f.name
FROM farmers f 
WHERE warehouse_entries.farmer_id = f.id 
AND (warehouse_entries.farmer_name IS NULL OR warehouse_entries.farmer_name = '');

-- Verify the update worked
SELECT 
    COUNT(*) as total_entries,
    COUNT(farmer_name) as entries_with_farmer_name,
    COUNT(*) - COUNT(farmer_name) as entries_without_farmer_name
FROM warehouse_entries;

-- Show sample of updated records
SELECT 
    id,
    farmer_id,
    farmer_name,
    total_weight,
    entry_date
FROM warehouse_entries 
WHERE farmer_name IS NOT NULL 
LIMIT 5;

-- Verify the schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'warehouse_entries'
AND column_name IN ('farmer_id', 'farmer_name')
ORDER BY ordinal_position;

SELECT 'farmer_name column fix completed successfully!' as status;
