-- Add Missing Transfer Columns
-- This script adds the missing size_class, quantity, and weight_kg columns to the transfers table

-- 1. Add the missing columns to the transfers table
DO $$
BEGIN
    -- Add size_class column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfers' AND column_name = 'size_class') THEN
        ALTER TABLE transfers ADD COLUMN size_class INTEGER;
        RAISE NOTICE 'Column size_class added to transfers table.';
    END IF;
    
    -- Add quantity column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfers' AND column_name = 'quantity') THEN
        ALTER TABLE transfers ADD COLUMN quantity INTEGER;
        RAISE NOTICE 'Column quantity added to transfers table.';
    END IF;
    
    -- Add weight_kg column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfers' AND column_name = 'weight_kg') THEN
        ALTER TABLE transfers ADD COLUMN weight_kg DECIMAL(10,2);
        RAISE NOTICE 'Column weight_kg added to transfers table.';
    END IF;
END $$;

-- 2. Check the updated table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'transfers' 
ORDER BY ordinal_position;

-- 3. Show current data with the new columns
SELECT 
    id,
    from_storage_name,
    to_storage_name,
    size_class,
    quantity,
    weight_kg,
    notes,
    status,
    created_at
FROM transfers 
ORDER BY created_at DESC;
