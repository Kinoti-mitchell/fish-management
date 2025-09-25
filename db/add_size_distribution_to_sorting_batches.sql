-- Add size_distribution column to sorting_batches table
-- This allows storing the distribution of fish pieces across size classes

-- Add the size_distribution column as JSONB to store size class distribution
ALTER TABLE sorting_batches 
ADD COLUMN IF NOT EXISTS size_distribution JSONB DEFAULT '{}';

-- Add storage_location_id column if it doesn't exist
ALTER TABLE sorting_batches 
ADD COLUMN IF NOT EXISTS storage_location_id UUID REFERENCES storage_locations(id);

-- Add index for better performance on size_distribution queries
CREATE INDEX IF NOT EXISTS idx_sorting_batches_size_distribution 
ON sorting_batches USING GIN (size_distribution);

-- Add index for storage_location_id
CREATE INDEX IF NOT EXISTS idx_sorting_batches_storage_location 
ON sorting_batches (storage_location_id);

-- Update existing records to have empty size_distribution
UPDATE sorting_batches 
SET size_distribution = '{}' 
WHERE size_distribution IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN sorting_batches.size_distribution IS 'JSONB object storing fish piece distribution by size class (e.g., {"3": 20, "4": 30, "5": 50})';
COMMENT ON COLUMN sorting_batches.storage_location_id IS 'Reference to storage location where sorted fish will be stored';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON sorting_batches TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
