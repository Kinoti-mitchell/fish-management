-- Fix Transfer Data Type Issues
-- This script addresses the "invalid input syntax for type integer" error
-- and ensures proper data type handling in the transfer system

-- 1. First, let's check what's currently in the database
SELECT '=== CHECKING CURRENT TRANSFER FUNCTION ===' as section;

SELECT 
    routine_name,
    routine_type,
    data_type,
    parameter_name,
    parameter_mode,
    data_type as parameter_type
FROM information_schema.routines r
LEFT JOIN information_schema.parameters p ON r.specific_name = p.specific_name
WHERE r.routine_schema = 'public' 
AND r.routine_name = 'create_batch_transfer'
ORDER BY p.ordinal_position;

-- 2. Drop and recreate the function with proper data type handling
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
            v_size := CASE 
                WHEN jsonb_typeof(v_size_item->'size') = 'string' THEN
                    (v_size_item->>'size')::INTEGER
                WHEN jsonb_typeof(v_size_item->'size') = 'number' THEN
                    (v_size_item->'size')::INTEGER
                ELSE
                    RAISE EXCEPTION 'Size must be a valid integer, got: %', v_size_item->>'size'
            END;
            
            -- Handle quantity (must be integer)
            IF v_size_item->>'quantity' IS NULL THEN
                RAISE EXCEPTION 'Quantity cannot be null in size data';
            END IF;
            
            -- Convert quantity to integer, handling both string and numeric inputs
            v_quantity := CASE 
                WHEN jsonb_typeof(v_size_item->'quantity') = 'string' THEN
                    (v_size_item->>'quantity')::INTEGER
                WHEN jsonb_typeof(v_size_item->'quantity') = 'number' THEN
                    (v_size_item->'quantity')::INTEGER
                ELSE
                    RAISE EXCEPTION 'Quantity must be a valid integer, got: %', v_size_item->>'quantity'
            END;
            
            -- Handle weight (can be decimal)
            IF v_size_item->>'weightKg' IS NULL THEN
                RAISE EXCEPTION 'Weight cannot be null in size data';
            END IF;
            
            -- Convert weight to decimal, handling both string and numeric inputs
            v_weight_kg := CASE 
                WHEN jsonb_typeof(v_size_item->'weightKg') = 'string' THEN
                    (v_size_item->>'weightKg')::DECIMAL(10,2)
                WHEN jsonb_typeof(v_size_item->'weightKg') = 'number' THEN
                    (v_size_item->'weightKg')::DECIMAL(10,2)
                ELSE
                    RAISE EXCEPTION 'Weight must be a valid number, got: %', v_size_item->>'weightKg'
            END;
            
            -- Validate ranges
            IF v_size < 0 OR v_size > 10 THEN
                RAISE EXCEPTION 'Size must be between 0 and 10, got: %', v_size;
            END IF;
            
            IF v_quantity <= 0 THEN
                RAISE EXCEPTION 'Quantity must be positive, got: %', v_quantity;
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

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION create_batch_transfer TO authenticated;

-- 4. Test the function with sample data
SELECT '=== TESTING FUNCTION ===' as section;

-- Test with proper data types
SELECT create_batch_transfer(
    '00000000-0000-0000-0000-000000000001'::UUID, -- from storage
    '00000000-0000-0000-0000-000000000002'::UUID, -- to storage
    '[{"size": 3, "quantity": 100, "weightKg": 25.5}]'::JSONB,
    'Test transfer',
    NULL
) as test_result;

-- 5. Check for any existing problematic data
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
   OR quantity IS NULL 
   OR weight_kg IS NULL
   OR size_class < 0 
   OR size_class > 10
   OR quantity <= 0
   OR weight_kg <= 0
ORDER BY created_at DESC
LIMIT 10;

-- 6. Clean up any problematic data (optional - uncomment if needed)
-- UPDATE transfers 
-- SET size_class = 3, quantity = 1, weight_kg = 1.0
-- WHERE size_class IS NULL OR quantity IS NULL OR weight_kg IS NULL;

SELECT 'Transfer system data type fixes completed successfully!' as status;
