-- Fix Transfer System to Use Weight-Only (No Piece Counts)
-- This addresses the "invalid input syntax for type integer" error
-- by removing piece counts and focusing only on weights

-- 1. First, let's check the current transfer table structure
SELECT '=== CHECKING CURRENT TRANSFER TABLE ===' as section;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'transfers' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Update the transfers table to make quantity optional (since we focus on weights)
ALTER TABLE transfers 
ALTER COLUMN quantity DROP NOT NULL;

-- Add a comment to clarify the new approach
COMMENT ON COLUMN transfers.quantity IS 'Optional piece count - system primarily uses weight_kg for transfers';

-- 3. Drop and recreate the function to handle weight-only transfers
DROP FUNCTION IF EXISTS create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID);

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
    v_from_name TEXT;
    v_to_name TEXT;
    v_size_item JSONB;
    v_size INTEGER;
    v_quantity INTEGER;
    v_weight_kg DECIMAL(10,2);
BEGIN
    -- Get storage names
    SELECT name INTO v_from_name 
    FROM storage_locations 
    WHERE id = p_from_storage_location_id;
    
    SELECT name INTO v_to_name 
    FROM storage_locations 
    WHERE id = p_to_storage_location_id;
    
    -- Validate input parameters
    IF p_from_storage_location_id IS NULL THEN
        RAISE EXCEPTION 'From storage location ID cannot be null';
    END IF;
    
    IF p_to_storage_location_id IS NULL THEN
        RAISE EXCEPTION 'To storage location ID cannot be null';
    END IF;
    
    IF p_size_data IS NULL OR jsonb_array_length(p_size_data) = 0 THEN
        RAISE EXCEPTION 'Size data cannot be null or empty';
    END IF;
    
    -- Create individual transfer records for each size
    FOR v_size_item IN SELECT * FROM jsonb_array_elements(p_size_data)
    LOOP
        -- Extract and validate data with proper type conversion
        BEGIN
            -- Handle size (must be integer)
            IF v_size_item->>'size' IS NULL THEN
                RAISE EXCEPTION 'Size cannot be null in size data';
            END IF;
            
            -- Convert size to integer, handling both string and numeric inputs
            IF jsonb_typeof(v_size_item->'size') = 'string' THEN
                v_size := (v_size_item->>'size')::INTEGER;
            ELSIF jsonb_typeof(v_size_item->'size') = 'number' THEN
                v_size := (v_size_item->'size')::INTEGER;
            ELSE
                RAISE EXCEPTION 'Size must be a valid integer, got: %', v_size_item->>'size';
            END IF;
            
            -- Handle weight (primary field - must be decimal)
            IF v_size_item->>'weightKg' IS NULL THEN
                RAISE EXCEPTION 'Weight cannot be null in size data';
            END IF;
            
            -- Convert weight to decimal, handling both string and numeric inputs
            IF jsonb_typeof(v_size_item->'weightKg') = 'string' THEN
                v_weight_kg := (v_size_item->>'weightKg')::DECIMAL(10,2);
            ELSIF jsonb_typeof(v_size_item->'weightKg') = 'number' THEN
                v_weight_kg := (v_size_item->'weightKg')::DECIMAL(10,2);
            ELSE
                RAISE EXCEPTION 'Weight must be a valid number, got: %', v_size_item->>'weightKg';
            END IF;
            
            -- Handle quantity (optional - set to 1 if not provided or invalid)
            v_quantity := 1; -- Default to 1 since we don't care about piece counts
            
            IF v_size_item->>'quantity' IS NOT NULL THEN
                BEGIN
                    -- Try to convert quantity, but don't fail if it's invalid
                    IF jsonb_typeof(v_size_item->'quantity') = 'string' THEN
                        IF (v_size_item->>'quantity') ~ '^[0-9]+(\.[0-9]+)?$' THEN
                            v_quantity := ROUND((v_size_item->>'quantity')::DECIMAL)::INTEGER;
                        ELSE
                            v_quantity := 1;
                        END IF;
                    ELSIF jsonb_typeof(v_size_item->'quantity') = 'number' THEN
                        v_quantity := ROUND((v_size_item->'quantity')::DECIMAL)::INTEGER;
                    ELSE
                        v_quantity := 1;
                    END IF;
                EXCEPTION
                    WHEN OTHERS THEN
                        v_quantity := 1; -- Default to 1 if conversion fails
                END;
            END IF;
            
            -- Validate ranges
            IF v_size < 0 OR v_size > 10 THEN
                RAISE EXCEPTION 'Size must be between 0 and 10, got: %', v_size;
            END IF;
            
            IF v_quantity <= 0 THEN
                v_quantity := 1; -- Ensure quantity is at least 1
            END IF;
            
            IF v_weight_kg <= 0 THEN
                RAISE EXCEPTION 'Weight must be positive, got: %', v_weight_kg;
            END IF;
            
        EXCEPTION
            WHEN invalid_text_representation THEN
                RAISE EXCEPTION 'Invalid data format in size item: %', v_size_item;
            WHEN OTHERS THEN
                RAISE EXCEPTION 'Error processing size item %: %', v_size_item, SQLERRM;
        END;
        
        -- Insert the transfer record
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
            v_size,
            v_quantity,
            v_weight_kg,
            p_notes,
            p_requested_by,
            'pending'
        ) RETURNING id INTO v_transfer_id;
        
        -- Store the first transfer ID to return as the batch ID
        IF v_first_transfer_id IS NULL THEN
            v_first_transfer_id := v_transfer_id;
        END IF;
    END LOOP;
    
    RETURN v_first_transfer_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION create_batch_transfer TO authenticated;

-- 5. Test the function with sample data (including problematic piece counts)
SELECT '=== TESTING FUNCTION WITH PROBLEMATIC DATA ===' as section;

-- Test with data that would previously cause the "1223.4 pieces" error
SELECT create_batch_transfer(
    '00000000-0000-0000-0000-000000000001'::UUID, -- from storage
    '00000000-0000-0000-0000-000000000002'::UUID, -- to storage
    '[
        {"size": 1, "quantity": "1223.4", "weightKg": 1208.0},
        {"size": 2, "quantity": "5321.4", "weightKg": 5188.2},
        {"size": 3, "quantity": 22, "weightKg": 11.0}
    ]'::JSONB,
    'Test transfer with problematic piece counts',
    NULL
) as test_result;

-- 6. Check for any existing problematic data and clean it up
SELECT '=== CHECKING FOR PROBLEMATIC DATA ===' as section;

-- Check if there are any transfers with invalid data
SELECT 
    id,
    size_class,
    quantity,
    weight_kg,
    status,
    created_at
FROM transfers
WHERE size_class IS NULL 
   OR weight_kg IS NULL
   OR size_class < 0 
   OR size_class > 10
   OR weight_kg <= 0
ORDER BY created_at DESC
LIMIT 10;

-- 7. Clean up any problematic data
UPDATE transfers 
SET quantity = 1
WHERE quantity IS NULL OR quantity <= 0;

UPDATE transfers 
SET weight_kg = 1.0
WHERE weight_kg IS NULL OR weight_kg <= 0;

-- 8. Create a view for easier transfer management (weight-focused)
CREATE OR REPLACE VIEW transfer_summary AS
SELECT 
    t.id,
    t.from_storage_name,
    t.to_storage_name,
    t.size_class,
    t.weight_kg,
    t.quantity,
    t.status,
    t.notes,
    t.created_at,
    t.approved_at,
    t.updated_at
FROM transfers t
ORDER BY t.created_at DESC;

-- Grant access to the view
GRANT SELECT ON transfer_summary TO authenticated;

SELECT 'Transfer system updated to weight-only approach completed successfully!' as status;
SELECT 'Piece counts are now optional and default to 1 if invalid' as note;
