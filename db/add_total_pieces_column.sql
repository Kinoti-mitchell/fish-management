-- Add total_pieces column to processing_records table
-- This column will store the number of fish pieces processed

-- Add the column if it doesn't exist
ALTER TABLE processing_records 
ADD COLUMN IF NOT EXISTS total_pieces INTEGER DEFAULT 0;

-- Add comment to document the column
COMMENT ON COLUMN processing_records.total_pieces IS 'Number of fish pieces processed in this batch';

-- Update existing records to have a default value
UPDATE processing_records 
SET total_pieces = 0 
WHERE total_pieces IS NULL;
