-- Add entry code system to warehouse_entries table
-- This ensures each warehouse entry has a unique, human-readable identifier

-- Add entry_code column to warehouse_entries table
ALTER TABLE warehouse_entries 
ADD COLUMN IF NOT EXISTS entry_code VARCHAR(20) UNIQUE;

-- Create function to generate unique entry codes
CREATE OR REPLACE FUNCTION generate_warehouse_entry_code()
RETURNS TEXT AS $$
DECLARE
    sequence_num INTEGER;
    new_entry_code TEXT;
BEGIN
    -- Find the next sequence number
    SELECT COALESCE(MAX(
        CASE 
            WHEN we.entry_code ~ '^WE[0-9]+$' 
            THEN CAST(SUBSTRING(we.entry_code FROM 'WE([0-9]+)') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1 INTO sequence_num
    FROM warehouse_entries we
    WHERE we.entry_code IS NOT NULL;
    
    -- Generate the entry code (WE001, WE002, etc.)
    new_entry_code := 'WE' || LPAD(sequence_num::TEXT, 3, '0');
    
    RETURN new_entry_code;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically generate entry codes for new entries
CREATE OR REPLACE FUNCTION set_warehouse_entry_code()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set entry_code if it's not already provided
    IF NEW.entry_code IS NULL OR NEW.entry_code = '' THEN
        NEW.entry_code := generate_warehouse_entry_code();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_set_warehouse_entry_code ON warehouse_entries;
CREATE TRIGGER trigger_set_warehouse_entry_code
    BEFORE INSERT ON warehouse_entries
    FOR EACH ROW
    EXECUTE FUNCTION set_warehouse_entry_code();

-- Update existing entries that don't have entry codes
UPDATE warehouse_entries 
SET entry_code = generate_warehouse_entry_code()
WHERE entry_code IS NULL OR entry_code = '';

-- Add index for better performance on entry_code lookups
CREATE INDEX IF NOT EXISTS idx_warehouse_entries_entry_code ON warehouse_entries(entry_code);

-- Add comment to document the entry code format
COMMENT ON COLUMN warehouse_entries.entry_code IS 'Unique entry code in format WE001, WE002, etc.';
