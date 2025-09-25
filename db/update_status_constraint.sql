-- Update outlet_orders status CHECK constraint to include 'assigned'
-- Run this AFTER running add_assigned_status.sql and committing the transaction

-- Update CHECK constraint to include 'assigned' status
DO $$
BEGIN
    -- Check if outlet_orders table exists and has a status column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'outlet_orders' 
        AND column_name = 'status'
    ) THEN
        -- Drop the existing CHECK constraint if it exists
        ALTER TABLE outlet_orders DROP CONSTRAINT IF EXISTS outlet_orders_status_check;
        
        -- Add new CHECK constraint with 'assigned' status
        ALTER TABLE outlet_orders ADD CONSTRAINT outlet_orders_status_check 
        CHECK (status IN ('pending', 'confirmed', 'assigned', 'processing', 'dispatched', 'delivered', 'cancelled'));
        
        RAISE NOTICE 'Updated outlet_orders status CHECK constraint to include "assigned"';
    ELSE
        RAISE NOTICE 'outlet_orders table or status column not found';
    END IF;
END $$;


