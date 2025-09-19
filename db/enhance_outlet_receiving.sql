-- Enhance Outlet Receiving Table
-- Add missing columns and improve data structure for better receiving tracking

-- Add missing columns to outlet_receiving table
ALTER TABLE outlet_receiving 
ADD COLUMN IF NOT EXISTS outlet_name TEXT;

ALTER TABLE outlet_receiving 
ADD COLUMN IF NOT EXISTS outlet_location TEXT;

-- Update existing records to populate outlet information from dispatch records
UPDATE outlet_receiving 
SET 
    outlet_name = dr.destination,
    outlet_location = dr.destination
FROM dispatch_records dr
WHERE outlet_receiving.dispatch_id = dr.id
AND (outlet_receiving.outlet_name IS NULL OR outlet_receiving.outlet_location IS NULL);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_outlet_receiving_dispatch_id ON outlet_receiving(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_outlet_receiving_outlet_order_id ON outlet_receiving(outlet_order_id);
CREATE INDEX IF NOT EXISTS idx_outlet_receiving_received_date ON outlet_receiving(received_date);
CREATE INDEX IF NOT EXISTS idx_outlet_receiving_status ON outlet_receiving(status);

-- Create index on size_discrepancies for JSONB queries
CREATE INDEX IF NOT EXISTS idx_outlet_receiving_size_discrepancies ON outlet_receiving USING GIN (size_discrepancies);

-- Add comments for documentation
COMMENT ON COLUMN outlet_receiving.outlet_name IS 'Name of the outlet that received the dispatch';
COMMENT ON COLUMN outlet_receiving.outlet_location IS 'Location of the outlet that received the dispatch';
COMMENT ON COLUMN outlet_receiving.size_discrepancies IS 'JSONB object mapping size numbers to discrepancy amounts (e.g., {"3": -2.5, "4": 1.0})';

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON outlet_receiving TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Verify the enhancements
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'outlet_receiving'
ORDER BY ordinal_position;
