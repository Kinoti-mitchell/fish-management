-- Fix requested_quantity type mismatch
-- The database expects INTEGER but we need to support decimal weights in kg

-- Update the requested_quantity column to support decimal values
ALTER TABLE outlet_orders 
ALTER COLUMN requested_quantity TYPE DECIMAL(10,2);

-- Add comment to clarify the column purpose
COMMENT ON COLUMN outlet_orders.requested_quantity IS 'Total quantity requested in kg (supports decimal values)';

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON outlet_orders TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
