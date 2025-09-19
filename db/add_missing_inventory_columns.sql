-- Add Missing Columns to inventory_entries Table
-- This adds the columns that the existing logic expects

-- Add missing columns to inventory_entries table
ALTER TABLE inventory_entries 
ADD COLUMN IF NOT EXISTS reference_type TEXT;

ALTER TABLE inventory_entries 
ADD COLUMN IF NOT EXISTS fish_type TEXT;

ALTER TABLE inventory_entries 
ADD COLUMN IF NOT EXISTS quantity INTEGER;

ALTER TABLE inventory_entries 
ADD COLUMN IF NOT EXISTS unit_weight DECIMAL(10,2);

ALTER TABLE inventory_entries 
ADD COLUMN IF NOT EXISTS total_weight DECIMAL(10,2);

ALTER TABLE inventory_entries 
ADD COLUMN IF NOT EXISTS size_distribution JSONB;

ALTER TABLE inventory_entries 
ADD COLUMN IF NOT EXISTS storage_location TEXT;

ALTER TABLE inventory_entries 
ADD COLUMN IF NOT EXISTS quality_grade TEXT;

ALTER TABLE inventory_entries 
ADD COLUMN IF NOT EXISTS entry_date DATE;

ALTER TABLE inventory_entries 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_entries_reference_type ON inventory_entries(reference_type);
CREATE INDEX IF NOT EXISTS idx_inventory_entries_fish_type ON inventory_entries(fish_type);
CREATE INDEX IF NOT EXISTS idx_inventory_entries_storage_location ON inventory_entries(storage_location);
CREATE INDEX IF NOT EXISTS idx_inventory_entries_created_by ON inventory_entries(created_by);
CREATE INDEX IF NOT EXISTS idx_inventory_entries_entry_date ON inventory_entries(entry_date);

-- Add comments for documentation
COMMENT ON COLUMN inventory_entries.reference_type IS 'Type of reference (e.g., outlet_order, outlet_receiving)';
COMMENT ON COLUMN inventory_entries.fish_type IS 'Type of fish (e.g., Tilapia)';
COMMENT ON COLUMN inventory_entries.quantity IS 'Quantity in pieces';
COMMENT ON COLUMN inventory_entries.unit_weight IS 'Weight per unit in kg';
COMMENT ON COLUMN inventory_entries.total_weight IS 'Total weight in kg';
COMMENT ON COLUMN inventory_entries.size_distribution IS 'JSONB object with size distribution';
COMMENT ON COLUMN inventory_entries.storage_location IS 'Storage location description';
COMMENT ON COLUMN inventory_entries.quality_grade IS 'Quality grade (A, B, C, etc.)';
COMMENT ON COLUMN inventory_entries.entry_date IS 'Date of the entry';
COMMENT ON COLUMN inventory_entries.created_by IS 'User who created the entry';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_entries TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Verify the new columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'inventory_entries'
ORDER BY ordinal_position;
