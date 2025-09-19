-- Add 'assigned' status to order_status enum
-- Run this in Supabase SQL Editor

-- First, check if the enum exists and what values it has
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (
    SELECT oid 
    FROM pg_type 
    WHERE typname = 'order_status'
);

-- Add 'assigned' to the order_status enum if it doesn't exist
DO $$
BEGIN
    -- Check if 'assigned' already exists in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'order_status'
        ) 
        AND enumlabel = 'assigned'
    ) THEN
        -- Add 'assigned' to the enum
        ALTER TYPE order_status ADD VALUE 'assigned';
        RAISE NOTICE 'Added "assigned" to order_status enum';
    ELSE
        RAISE NOTICE '"assigned" already exists in order_status enum';
    END IF;
END $$;
