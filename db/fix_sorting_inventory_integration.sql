-- Fix Sorting to Inventory Integration Issues
-- This script addresses the 400 and 406 errors in the sorting system

-- Step 1: Fix the add_stock_from_sorting function to handle errors better
CREATE OR REPLACE FUNCTION add_stock_from_sorting(p_sorting_batch_id UUID)
RETURNS TABLE(
    id UUID,
    size INTEGER,
    quantity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_sorting_batch RECORD;
    v_sorting_result RECORD;
    v_inventory_id UUID;
    v_inventory_size INTEGER;
    v_new_quantity INTEGER;
    v_created_at TIMESTAMP WITH TIME ZONE;
    v_updated_at TIMESTAMP WITH TIME ZONE;
    v_total_added INTEGER := 0;
BEGIN
    -- Validate input parameter
    IF p_sorting_batch_id IS NULL THEN
        RAISE EXCEPTION 'Sorting batch ID cannot be null';
    END IF;
    
    -- Get the sorting batch
    SELECT * INTO v_sorting_batch 
    FROM sorting_batches 
    WHERE id = p_sorting_batch_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sorting batch not found: %', p_sorting_batch_id;
    END IF;
    
    -- Check if sorting batch is completed
    IF v_sorting_batch.status != 'completed' THEN
        RAISE EXCEPTION 'Sorting batch must be completed before adding to inventory. Current status: %', v_sorting_batch.status;
    END IF;
    
    -- Check if this sorting batch has already been added to inventory
    IF EXISTS (
        SELECT 1 FROM inventory_entries 
        WHERE reference_id = p_sorting_batch_id 
        AND entry_type = 'sorting'
    ) THEN
        RAISE EXCEPTION 'This sorting batch has already been added to inventory';
    END IF;
    
    -- Process each size class from sorting results
    FOR v_sorting_result IN 
        SELECT * FROM sorting_results 
        WHERE sorting_batch_id = p_sorting_batch_id
        AND total_pieces > 0
    LOOP
        v_inventory_size := v_sorting_result.size_class;
        v_new_quantity := v_sorting_result.total_pieces;
        
        -- Check if inventory entry already exists for this size
        SELECT id, quantity INTO v_inventory_id, v_new_quantity
        FROM inventory_entries 
        WHERE size = v_inventory_size 
        AND entry_type = 'sorting'
        AND reference_id = p_sorting_batch_id;
        
        IF FOUND THEN
            -- Update existing entry
            UPDATE inventory_entries 
            SET 
                quantity = quantity + v_new_quantity,
                updated_at = NOW()
            WHERE id = v_inventory_id
            RETURNING id, size, quantity, created_at, updated_at
            INTO v_inventory_id, v_inventory_size, v_new_quantity, v_created_at, v_updated_at;
        ELSE
            -- Create new inventory entry
            INSERT INTO inventory_entries (
                size,
                quantity,
                entry_type,
                reference_id,
                created_at,
                updated_at
            ) VALUES (
                v_inventory_size,
                v_new_quantity,
                'sorting',
                p_sorting_batch_id,
                NOW(),
                NOW()
            ) RETURNING id, size, quantity, created_at, updated_at
            INTO v_inventory_id, v_inventory_size, v_new_quantity, v_created_at, v_updated_at;
        END IF;
        
        -- Return the inventory entry
        RETURN QUERY SELECT v_inventory_id, v_inventory_size, v_new_quantity, v_created_at, v_updated_at;
        
        v_total_added := v_total_added + v_new_quantity;
    END LOOP;
    
    -- If no sorting results found, try to use size_distribution from sorting_batches
    IF v_total_added = 0 THEN
        -- Check if sorting_batch has size_distribution data
        IF v_sorting_batch.size_distribution IS NOT NULL AND jsonb_typeof(v_sorting_batch.size_distribution) = 'object' THEN
            -- Process size_distribution JSONB
            FOR v_inventory_size, v_new_quantity IN 
                SELECT 
                    (key::INTEGER) as size,
                    (value::NUMERIC)::INTEGER as quantity
                FROM jsonb_each(v_sorting_batch.size_distribution)
                WHERE (value::NUMERIC) > 0
            LOOP
                -- Create inventory entry
                INSERT INTO inventory_entries (
                    size,
                    quantity,
                    entry_type,
                    reference_id,
                    created_at,
                    updated_at
                ) VALUES (
                    v_inventory_size,
                    v_new_quantity,
                    'sorting',
                    p_sorting_batch_id,
                    NOW(),
                    NOW()
                ) RETURNING id, size, quantity, created_at, updated_at
                INTO v_inventory_id, v_inventory_size, v_new_quantity, v_created_at, v_updated_at;
                
                -- Return the inventory entry
                RETURN QUERY SELECT v_inventory_id, v_inventory_size, v_new_quantity, v_created_at, v_updated_at;
                
                v_total_added := v_total_added + v_new_quantity;
            END LOOP;
        END IF;
    END IF;
    
    -- If still no entries created, raise an exception
    IF v_total_added = 0 THEN
        RAISE EXCEPTION 'No valid sorting results found for batch %', p_sorting_batch_id;
    END IF;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Grant permissions for the function
GRANT EXECUTE ON FUNCTION add_stock_from_sorting TO authenticated;
GRANT EXECUTE ON FUNCTION add_stock_from_sorting TO anon;

-- Step 3: Fix RLS policies for inventory_entries if needed
DROP POLICY IF EXISTS "Users can view inventory entries" ON inventory_entries;
DROP POLICY IF EXISTS "Users can create inventory entries" ON inventory_entries;
DROP POLICY IF EXISTS "Users can update inventory entries" ON inventory_entries;

CREATE POLICY "Allow all authenticated users to view inventory entries" ON inventory_entries
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated users to create inventory entries" ON inventory_entries
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated users to update inventory entries" ON inventory_entries
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Step 4: Fix RLS policies for sorting_results if needed
DROP POLICY IF EXISTS "Users can view sorting results" ON sorting_results;
DROP POLICY IF EXISTS "Users can create sorting results" ON sorting_results;

CREATE POLICY "Allow all authenticated users to view sorting results" ON sorting_results
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated users to create sorting results" ON sorting_results
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Step 5: Create a simpler function for testing
CREATE OR REPLACE FUNCTION test_add_stock_from_sorting(p_sorting_batch_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_batch RECORD;
BEGIN
    -- Get batch info
    SELECT * INTO v_batch FROM sorting_batches WHERE id = p_sorting_batch_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Batch not found', 'batch_id', p_sorting_batch_id);
    END IF;
    
    RETURN jsonb_build_object(
        'batch_id', p_sorting_batch_id,
        'batch_number', v_batch.batch_number,
        'status', v_batch.status,
        'size_distribution', v_batch.size_distribution,
        'has_sorting_results', EXISTS(SELECT 1 FROM sorting_results WHERE sorting_batch_id = p_sorting_batch_id),
        'already_in_inventory', EXISTS(SELECT 1 FROM inventory_entries WHERE reference_id = p_sorting_batch_id AND entry_type = 'sorting')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION test_add_stock_from_sorting TO authenticated;
GRANT EXECUTE ON FUNCTION test_add_stock_from_sorting TO anon;

-- Step 6: Verify functions exist
SELECT 
    'Functions created successfully:' as status,
    proname as function_name,
    prokind as function_type
FROM pg_proc 
WHERE proname IN ('add_stock_from_sorting', 'test_add_stock_from_sorting');

-- Step 7: Show current sorting batches that might need inventory integration
SELECT 
    'Sorting batches ready for inventory:' as status,
    sb.id,
    sb.batch_number,
    sb.status,
    sb.size_distribution,
    CASE 
        WHEN EXISTS(SELECT 1 FROM inventory_entries WHERE reference_id = sb.id AND entry_type = 'sorting') 
        THEN 'Already in inventory'
        ELSE 'Not in inventory'
    END as inventory_status
FROM sorting_batches sb
WHERE sb.status = 'completed'
ORDER BY sb.created_at DESC
LIMIT 10;
