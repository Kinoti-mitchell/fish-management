-- Complete Transfer System Fix
-- This script adds missing columns and fixes the create_batch_transfer function

-- 1. Add missing columns to the transfers table
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

-- 2. Drop existing create_batch_transfer function to avoid conflicts
DROP FUNCTION IF EXISTS create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID) CASCADE;

-- 3. Create the fixed create_batch_transfer function
CREATE OR REPLACE FUNCTION create_batch_transfer(
    p_from_storage_location_id UUID,
    p_to_storage_location_id UUID,
    p_size_data JSONB,
    p_notes TEXT DEFAULT NULL,
    p_requested_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_transfer_id UUID;
    v_first_transfer_id UUID;
    v_batch_transfer_id UUID;
    v_from_name TEXT;
    v_to_name TEXT;
    v_size_item JSONB;
BEGIN
    -- Get storage names
    SELECT name INTO v_from_name FROM storage_locations WHERE id = p_from_storage_location_id;
    SELECT name INTO v_to_name FROM storage_locations WHERE id = p_to_storage_location_id;

    -- Create individual transfer records for each size
    FOR v_size_item IN SELECT * FROM jsonb_array_elements(p_size_data)
    LOOP
        INSERT INTO transfers (
            from_storage_location_id,
            to_storage_location_id,
            from_storage_name,
            to_storage_name,
            size_class,
            quantity,
            weight_kg,
            notes,
            requested_by,
            status
        ) VALUES (
            p_from_storage_location_id,
            p_to_storage_location_id,
            COALESCE(v_from_name, 'Unknown'),
            COALESCE(v_to_name, 'Unknown'),
            (v_size_item->>'size')::INTEGER,
            (v_size_item->>'quantity')::INTEGER,
            (v_size_item->>'weightKg')::DECIMAL(10,2),
            p_notes,
            p_requested_by,
            'pending'
        ) RETURNING id INTO v_first_transfer_id;

        -- Store the first transfer ID to return as the batch ID
        IF v_batch_transfer_id IS NULL THEN
            v_batch_transfer_id := v_first_transfer_id;
        END IF;
    END LOOP;

    RETURN v_batch_transfer_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Grant permissions on the function
GRANT EXECUTE ON FUNCTION create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID) TO authenticated;

-- 5. Check the updated table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'transfers' 
ORDER BY ordinal_position;

-- 6. Show current data with the new columns
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

-- 7. Success message
SELECT 'Transfer system completely fixed! All columns added and function updated.' as status;
