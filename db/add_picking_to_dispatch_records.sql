-- Add picking date and time columns to dispatch_records table
-- This adds support for scheduling when orders should be picked for dispatch

-- Add picking_date column (DATE for when the order should be picked)
ALTER TABLE dispatch_records 
ADD COLUMN IF NOT EXISTS picking_date DATE;

-- Add picking_time column (TIME for when the order should be picked)
ALTER TABLE dispatch_records 
ADD COLUMN IF NOT EXISTS picking_time TIME;

-- Add assigned_driver column (TEXT for driver name)
ALTER TABLE dispatch_records 
ADD COLUMN IF NOT EXISTS assigned_driver TEXT;

-- Add assigned_date column (DATE for when driver was assigned)
ALTER TABLE dispatch_records 
ADD COLUMN IF NOT EXISTS assigned_date DATE;

-- Add comments for documentation
COMMENT ON COLUMN dispatch_records.picking_date IS 'Date when the order should be picked for dispatch';
COMMENT ON COLUMN dispatch_records.picking_time IS 'Time when the order should be picked for dispatch';
COMMENT ON COLUMN dispatch_records.assigned_driver IS 'Name of the driver assigned to this dispatch';
COMMENT ON COLUMN dispatch_records.assigned_date IS 'Date when the driver was assigned to this dispatch';

-- Create indexes for better performance on date/time queries
CREATE INDEX IF NOT EXISTS idx_dispatch_records_picking_date ON dispatch_records(picking_date);
CREATE INDEX IF NOT EXISTS idx_dispatch_records_picking_time ON dispatch_records(picking_time);
CREATE INDEX IF NOT EXISTS idx_dispatch_records_assigned_driver ON dispatch_records(assigned_driver);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON dispatch_records TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
