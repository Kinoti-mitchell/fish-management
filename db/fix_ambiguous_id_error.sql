-- Fix Ambiguous ID Error in add_stock_from_sorting Function
-- This addresses the "column reference 'id' is ambiguous" error

-- Drop and recreate the function with proper table qualification
DROP FUNCTION IF EXISTS add_stock_from_sorting(UUID);

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
    v_size_key TEXT;
    v_quantity INTEGER;
BEGIN
    -- Validate input parameter
    IF p_sorting_batch_id IS NULL THEN
        RAISE EXCEPTION 'Sorting batch ID cannot be null';
    END IF;
    
    -- Get the sorting batch
    SELECT * INTO v_sorting_batch 
    FROM sorting_batches 
    WHERE sorting_batches.id = p_sorting_batch_id;
    
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
        WHERE inventory_entries.reference_id = p_sorting_batch_id 
        AND inventory_entries.entry_type = 'sorting'
    ) THEN
        RAISE EXCEPTION 'This sorting batch has already been added to inventory';
    END IF;
    
    -- First try to process from sorting_results table
    FOR v_sorting_result IN 
        SELECT * FROM sorting_results 
        WHERE sorting_results.sorting_batch_id = p_sorting_batch_id
        AND sorting_results.total_pieces > 0
    LOOP
        v_inventory_size := v_sorting_result.size_class;
        v_new_quantity := v_sorting_result.total_pieces;
        
        -- Validate size class
        IF v_inventory_size < 0 OR v_inventory_size > 10 THEN
            CONTINUE; -- Skip invalid sizes
        END IF;
        
        -- Insert or update inventory with proper table qualification
        INSERT INTO inventory (size, quantity)
        VALUES (v_inventory_size, v_new_quantity)
        ON CONFLICT (size) 
        DO UPDATE SET 
            quantity = inventory.quantity + v_new_quantity,
            updated_at = NOW()
        RETURNING inventory.id, inventory.size, inventory.quantity, inventory.created_at, inventory.updated_at
        INTO v_inventory_id, v_inventory_size, v_new_quantity, v_created_at, v_updated_at;
        
        -- Log the entry with proper table qualification
        INSERT INTO inventory_entries (size, quantity_change, entry_type, reference_id, notes)
        VALUES (v_inventory_size, v_new_quantity, 'sorting', p_sorting_batch_id, 
                'From sorting batch ' || v_sorting_batch.batch_number || ' - ' || v_sorting_batch.sorting_date::TEXT);
        
        -- Return the inventory entry
        RETURN QUERY SELECT v_inventory_id, v_inventory_size, v_new_quantity, v_created_at, v_updated_at;
        
        v_total_added := v_total_added + v_new_quantity;
    END LOOP;
    
    -- If no sorting results found, try to use size_distribution from sorting_batches
    IF v_total_added = 0 THEN
        -- Check if sorting_batch has size_distribution data
        IF v_sorting_batch.size_distribution IS NOT NULL AND jsonb_typeof(v_sorting_batch.size_distribution) = 'object' THEN
            -- Process size_distribution JSONB
            FOR v_size_key, v_quantity IN 
                SELECT 
                    key,
                    (value::NUMERIC)::INTEGER
                FROM jsonb_each_text(v_sorting_batch.size_distribution)
                WHERE (value::NUMERIC) > 0
            LOOP
                v_inventory_size := v_size_key::INTEGER;
                v_new_quantity := v_quantity;
                
                -- Validate size
                IF v_inventory_size < 0 OR v_inventory_size > 10 THEN
                    CONTINUE; -- Skip invalid sizes
                END IF;
                
                -- Insert or update inventory with proper table qualification
                INSERT INTO inventory (size, quantity)
                VALUES (v_inventory_size, v_new_quantity)
                ON CONFLICT (size) 
                DO UPDATE SET 
                    quantity = inventory.quantity + v_new_quantity,
                    updated_at = NOW()
                RETURNING inventory.id, inventory.size, inventory.quantity, inventory.created_at, inventory.updated_at
                INTO v_inventory_id, v_inventory_size, v_new_quantity, v_created_at, v_updated_at;
                
                -- Log the entry with proper table qualification
                INSERT INTO inventory_entries (size, quantity_change, entry_type, reference_id, notes)
                VALUES (v_inventory_size, v_new_quantity, 'sorting', p_sorting_batch_id, 
                        'From sorting batch ' || v_sorting_batch.batch_number || ' - size distribution');
                
                -- Return the inventory entry
                RETURN QUERY SELECT v_inventory_id, v_inventory_size, v_new_quantity, v_created_at, v_updated_at;
                
                v_total_added := v_total_added + v_new_quantity;
            END LOOP;
        END IF;
    END IF;
    
    -- If still no entries created, raise an exception
    IF v_total_added = 0 THEN
        RAISE EXCEPTION 'No valid sorting results found for batch %. Check sorting_results table or size_distribution field.', p_sorting_batch_id;
    END IF;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for the function
GRANT EXECUTE ON FUNCTION add_stock_from_sorting TO authenticated;
GRANT EXECUTE ON FUNCTION add_stock_from_sorting TO anon;

-- Create a test function to help debug issues
CREATE OR REPLACE FUNCTION test_sorting_batch_debug(p_sorting_batch_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_batch RECORD;
    v_results_count INTEGER;
    v_size_distribution JSONB;
BEGIN
    -- Get batch info
    SELECT * INTO v_batch FROM sorting_batches WHERE sorting_batches.id = p_sorting_batch_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Batch not found', 'batch_id', p_sorting_batch_id);
    END IF;
    
    -- Count sorting results
    SELECT COUNT(*) INTO v_results_count 
    FROM sorting_results 
    WHERE sorting_results.sorting_batch_id = p_sorting_batch_id;
    
    -- Get size distribution
    v_size_distribution := v_batch.size_distribution;
    
    RETURN jsonb_build_object(
        'batch_id', p_sorting_batch_id,
        'batch_number', v_batch.batch_number,
        'status', v_batch.status,
        'size_distribution', v_size_distribution,
        'sorting_results_count', v_results_count,
        'has_sorting_results', v_results_count > 0,
        'already_in_inventory', EXISTS(
            SELECT 1 FROM inventory_entries 
            WHERE inventory_entries.reference_id = p_sorting_batch_id 
            AND inventory_entries.entry_type = 'sorting'
        ),
        'size_distribution_keys', CASE 
            WHEN v_size_distribution IS NOT NULL THEN 
                (SELECT jsonb_agg(key) FROM jsonb_object_keys(v_size_distribution))
            ELSE NULL
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION test_sorting_batch_debug TO authenticated;
GRANT EXECUTE ON FUNCTION test_sorting_batch_debug TO anon;

-- Show current sorting batches that might need inventory integration
SELECT 
    'Current sorting batches analysis:' as status,
    sb.id,
    sb.batch_number,
    sb.status,
    sb.size_distribution,
    CASE 
        WHEN EXISTS(SELECT 1 FROM inventory_entries WHERE inventory_entries.reference_id = sb.id AND inventory_entries.entry_type = 'sorting') 
        THEN 'Already in inventory'
        ELSE 'Not in inventory'
    END as inventory_status,
    (SELECT COUNT(*) FROM sorting_results WHERE sorting_results.sorting_batch_id = sb.id) as sorting_results_count
FROM sorting_batches sb
WHERE sb.status = 'completed'
ORDER BY sb.created_at DESC
LIMIT 10;
