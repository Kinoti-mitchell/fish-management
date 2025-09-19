-- Create Dedicated Outlet Receiving Inventory Table
-- This creates a separate table specifically for outlet receiving inventory tracking

-- Create the outlet_receiving_inventory table
CREATE TABLE IF NOT EXISTS outlet_receiving_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_receiving_id UUID NOT NULL REFERENCES outlet_receiving(id) ON DELETE CASCADE,
    dispatch_id UUID REFERENCES dispatch_records(id),
    outlet_order_id UUID REFERENCES outlet_orders(id),
    
    -- Fish details
    fish_type TEXT NOT NULL DEFAULT 'Tilapia',
    quantity INTEGER NOT NULL DEFAULT 0,
    unit_weight DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_weight DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- Size and quality information
    size_distribution JSONB,
    quality_grade TEXT,
    condition condition_type,
    
    -- Location and tracking
    outlet_name TEXT,
    outlet_location TEXT,
    storage_location TEXT,
    
    -- Dates and user tracking
    received_date DATE NOT NULL,
    entry_date DATE DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES profiles(id),
    
    -- Additional information
    notes TEXT,
    discrepancy_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_outlet_receiving_inventory_outlet_receiving_id 
    ON outlet_receiving_inventory(outlet_receiving_id);
CREATE INDEX IF NOT EXISTS idx_outlet_receiving_inventory_dispatch_id 
    ON outlet_receiving_inventory(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_outlet_receiving_inventory_outlet_order_id 
    ON outlet_receiving_inventory(outlet_order_id);
CREATE INDEX IF NOT EXISTS idx_outlet_receiving_inventory_fish_type 
    ON outlet_receiving_inventory(fish_type);
CREATE INDEX IF NOT EXISTS idx_outlet_receiving_inventory_received_date 
    ON outlet_receiving_inventory(received_date);
CREATE INDEX IF NOT EXISTS idx_outlet_receiving_inventory_created_by 
    ON outlet_receiving_inventory(created_by);
CREATE INDEX IF NOT EXISTS idx_outlet_receiving_inventory_outlet_name 
    ON outlet_receiving_inventory(outlet_name);

-- Create GIN index for JSONB size_distribution
CREATE INDEX IF NOT EXISTS idx_outlet_receiving_inventory_size_distribution 
    ON outlet_receiving_inventory USING GIN (size_distribution);

-- Add comments for documentation
COMMENT ON TABLE outlet_receiving_inventory IS 'Dedicated table for tracking inventory received at outlets';
COMMENT ON COLUMN outlet_receiving_inventory.outlet_receiving_id IS 'Reference to the outlet_receiving record';
COMMENT ON COLUMN outlet_receiving_inventory.dispatch_id IS 'Reference to the dispatch record';
COMMENT ON COLUMN outlet_receiving_inventory.outlet_order_id IS 'Reference to the outlet order';
COMMENT ON COLUMN outlet_receiving_inventory.fish_type IS 'Type of fish received (e.g., Tilapia)';
COMMENT ON COLUMN outlet_receiving_inventory.quantity IS 'Number of pieces received';
COMMENT ON COLUMN outlet_receiving_inventory.unit_weight IS 'Average weight per piece in kg';
COMMENT ON COLUMN outlet_receiving_inventory.total_weight IS 'Total weight received in kg';
COMMENT ON COLUMN outlet_receiving_inventory.size_distribution IS 'JSONB object with size distribution details';
COMMENT ON COLUMN outlet_receiving_inventory.quality_grade IS 'Quality grade of the received fish';
COMMENT ON COLUMN outlet_receiving_inventory.condition IS 'Condition of the received fish';
COMMENT ON COLUMN outlet_receiving_inventory.outlet_name IS 'Name of the receiving outlet';
COMMENT ON COLUMN outlet_receiving_inventory.outlet_location IS 'Location of the receiving outlet';
COMMENT ON COLUMN outlet_receiving_inventory.storage_location IS 'Where the fish is stored at the outlet';
COMMENT ON COLUMN outlet_receiving_inventory.received_date IS 'Date when the fish was received';
COMMENT ON COLUMN outlet_receiving_inventory.entry_date IS 'Date when this inventory entry was created';
COMMENT ON COLUMN outlet_receiving_inventory.created_by IS 'User who created this inventory entry';
COMMENT ON COLUMN outlet_receiving_inventory.notes IS 'General notes about the received inventory';
COMMENT ON COLUMN outlet_receiving_inventory.discrepancy_notes IS 'Notes about any discrepancies in the received items';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON outlet_receiving_inventory TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_outlet_receiving_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_outlet_receiving_inventory_updated_at
    BEFORE UPDATE ON outlet_receiving_inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_outlet_receiving_inventory_updated_at();

-- Verify the table was created
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'outlet_receiving_inventory'
ORDER BY ordinal_position;
