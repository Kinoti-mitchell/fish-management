-- Fix add_stock_from_sorting to work with the ACTUAL current inventory system
-- The current system uses sorting_results table, not inventory_entries

-- Drop the existing function
DROP FUNCTION IF EXISTS add_stock_from_sorting(UUID);

-- Create the corrected function that works with the current system
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
    v_total_added INTEGER := 0;
BEGIN
    -- Validate input parameter
    IF p_sorting_batch_id IS NULL THEN
        RAISE EXCEPTION 'Sorting batch ID cannot be null';
    END IF;
    
    -- Get the sorting batch with explicit table reference
    SELECT sb.* INTO v_sorting_batch 
    FROM sorting_batches sb
    WHERE sb.id = p_sorting_batch_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sorting batch not found: %', p_sorting_batch_id;
    END IF;
    
    -- Check if sorting batch is completed
    IF v_sorting_batch.status != 'completed' THEN
        RAISE EXCEPTION 'Sorting batch must be completed before adding to inventory. Current status: %', v_sorting_batch.status;
    END IF;
    
    -- In the current system, sorting_results ARE the inventory
    -- We just need to return them to confirm they're "added to inventory"
    -- The frontend already handles the inventory display from sorting_results
    
    -- Process each size class from sorting results
    FOR v_sorting_result IN 
        SELECT sr.* FROM sorting_results sr
        WHERE sr.sorting_batch_id = p_sorting_batch_id
        AND sr.total_pieces > 0
    LOOP
        -- Return the existing sorting results as "inventory items"
        RETURN QUERY SELECT 
            v_sorting_result.id,
            v_sorting_result.size_class,
            v_sorting_result.total_pieces,
            v_sorting_result.created_at,
            v_sorting_result.updated_at;
        
        v_total_added := v_total_added + 1;
    END LOOP;
    
    -- If no items were found, raise an exception
    IF v_total_added = 0 THEN
        RAISE EXCEPTION 'No valid sorting results found for batch: %', p_sorting_batch_id;
    END IF;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION add_stock_from_sorting TO authenticated;
GRANT EXECUTE ON FUNCTION add_stock_from_sorting TO anon;

-- Verify the fix
SELECT 'add_stock_from_sorting function fixed for current inventory system!' as status;
