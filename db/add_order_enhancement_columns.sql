-- Add enhancement columns to outlet_orders table
-- This adds support for size-specific quantities and "any size" option

-- Add size_quantities column (JSONB to store size -> quantity mapping)
ALTER TABLE outlet_orders 
ADD COLUMN IF NOT EXISTS size_quantities JSONB DEFAULT '{}';

-- Add use_any_size column (boolean flag for "any size" orders)
ALTER TABLE outlet_orders 
ADD COLUMN IF NOT EXISTS use_any_size BOOLEAN DEFAULT false;

-- Add order_number column if it doesn't exist
ALTER TABLE outlet_orders 
ADD COLUMN IF NOT EXISTS order_number TEXT;

-- Create index on order_number for better performance
CREATE INDEX IF NOT EXISTS idx_outlet_orders_order_number ON outlet_orders(order_number);

-- Create index on size_quantities for JSONB queries
CREATE INDEX IF NOT EXISTS idx_outlet_orders_size_quantities ON outlet_orders USING GIN (size_quantities);

-- Add comments for documentation
COMMENT ON COLUMN outlet_orders.size_quantities IS 'JSONB object mapping size numbers to quantities in kg (e.g., {"3": 10.5, "4": 15.0})';
COMMENT ON COLUMN outlet_orders.use_any_size IS 'Boolean flag indicating if this order allows any available size';
COMMENT ON COLUMN outlet_orders.order_number IS 'Human-readable order number (e.g., INV001, INV002)';

-- Update existing orders to have default values
UPDATE outlet_orders 
SET 
    size_quantities = '{}',
    use_any_size = false
WHERE size_quantities IS NULL OR use_any_size IS NULL;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON outlet_orders TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
