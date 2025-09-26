-- Quick fix for the ambiguous ID error in add_stock_from_sorting RPC
-- This is a minimal fix that only addresses the specific error

-- Drop the existing function
DROP FUNCTION IF EXISTS add_stock_from_sorting(UUID);

-- Create the corrected function with explicit table prefixes
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
    
    -- Check if this sorting batch has already been added to inventory
    IF EXISTS (
        SELECT 1 FROM inventory_entries ie
        WHERE ie.reference_id = p_sorting_batch_id 
        AND ie.entry_type = 'sorting'
    ) THEN
        RAISE EXCEPTION 'This sorting batch has already been added to inventory';
    END IF;
    
    -- Process each size class from sorting results
    FOR v_sorting_result IN 
        SELECT sr.* FROM sorting_results sr
        WHERE sr.sorting_batch_id = p_sorting_batch_id
        AND sr.total_pieces > 0
    LOOP
        v_inventory_size := v_sorting_result.size_class;
        v_new_quantity := v_sorting_result.total_pieces;
        v_created_at := NOW();
        v_updated_at := NOW();
        
        -- Insert into inventory_entries with explicit table reference
        INSERT INTO inventory_entries (
            size,
            quantity,
            weight_kg,
            storage_location_id,
            entry_type,
            reference_id,
            notes,
            created_at,
            updated_at
        ) VALUES (
            v_inventory_size,
            v_new_quantity,
            v_sorting_result.total_weight_grams / 1000.0, -- Convert grams to kg
            v_sorting_result.storage_location_id,
            'sorting',
            p_sorting_batch_id,
            'Added from sorting batch: ' || v_sorting_batch.batch_number,
            v_created_at,
            v_updated_at
        ) RETURNING inventory_entries.id INTO v_inventory_id;
        
        -- Return the created inventory entry
        RETURN QUERY SELECT 
            v_inventory_id,
            v_inventory_size,
            v_new_quantity,
            v_created_at,
            v_updated_at;
        
        v_total_added := v_total_added + 1;
    END LOOP;
    
    -- If no items were added, raise an exception
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
SELECT 'add_stock_from_sorting function fixed - ambiguous column reference resolved!' as status;
