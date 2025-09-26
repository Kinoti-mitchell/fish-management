-- Complete fix for transfer function - adds missing columns and fixes the function

-- 1. Add missing columns to transfers table if they don't exist
DO $$
BEGIN
    -- Add from_storage_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfers' AND column_name = 'from_storage_name') THEN
        ALTER TABLE transfers ADD COLUMN from_storage_name TEXT;
    END IF;
    
    -- Add to_storage_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfers' AND column_name = 'to_storage_name') THEN
        ALTER TABLE transfers ADD COLUMN to_storage_name TEXT;
    END IF;
    
    -- Add approved_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfers' AND column_name = 'approved_by') THEN
        ALTER TABLE transfers ADD COLUMN approved_by UUID;
    END IF;
    
    -- Add approved_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfers' AND column_name = 'approved_at') THEN
        ALTER TABLE transfers ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 2. Drop and recreate the function with proper storage name population
DROP FUNCTION IF EXISTS create_batch_transfer CASCADE;

CREATE FUNCTION create_batch_transfer(
    p_from_storage_location_id UUID,
    p_to_storage_location_id UUID,
    p_size_data JSONB,
    p_notes TEXT DEFAULT NULL,
    p_requested_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_transfer_id UUID;
    v_first_transfer_id UUID;
    v_size_item JSONB;
    v_from_name TEXT;
    v_to_name TEXT;
BEGIN
    -- Get storage names
    SELECT name INTO v_from_name FROM storage_locations WHERE id = p_from_storage_location_id;
    SELECT name INTO v_to_name FROM storage_locations WHERE id = p_to_storage_location_id;
    
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
        ) RETURNING id INTO v_transfer_id;
        
        IF v_first_transfer_id IS NULL THEN
            v_first_transfer_id := v_transfer_id;
        END IF;
    END LOOP;
    
    RETURN v_first_transfer_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION create_batch_transfer TO authenticated;

-- 4. Update existing transfers that have NULL storage names
UPDATE transfers 
SET 
    from_storage_name = COALESCE(
        (SELECT name FROM storage_locations WHERE id = transfers.from_storage_location_id),
        'Unknown'
    ),
    to_storage_name = COALESCE(
        (SELECT name FROM storage_locations WHERE id = transfers.to_storage_location_id),
        'Unknown'
    )
WHERE from_storage_name IS NULL OR to_storage_name IS NULL;

SELECT 'Transfer function fixed and existing data updated!' as status;
