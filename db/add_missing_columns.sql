-- Add missing columns to processing_records table
-- Run this in your Supabase SQL Editor

-- Add processing_code column if it doesn't exist
ALTER TABLE processing_records 
ADD COLUMN IF NOT EXISTS processing_code VARCHAR(20);

-- Add total_pieces column if it doesn't exist
ALTER TABLE processing_records 
ADD COLUMN IF NOT EXISTS total_pieces INTEGER DEFAULT 0;

-- Add entry_code column to warehouse_entries if it doesn't exist
ALTER TABLE warehouse_entries 
ADD COLUMN IF NOT EXISTS entry_code VARCHAR(20);

-- Add comments
COMMENT ON COLUMN processing_records.processing_code IS 'Unique processing code in format PR001, PR002, etc.';
COMMENT ON COLUMN processing_records.total_pieces IS 'Number of fish pieces processed in this batch';
COMMENT ON COLUMN warehouse_entries.entry_code IS 'Unique entry code in format WE001, WE002, etc.';

-- Verify columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'processing_records' 
AND column_name IN ('processing_code', 'total_pieces')
ORDER BY column_name;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'warehouse_entries' 
AND column_name = 'entry_code';
