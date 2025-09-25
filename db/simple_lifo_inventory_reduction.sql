-- Simple FIFO Inventory Reduction
-- When orders are approved, reduce inventory using First In First Out

-- Simple function to reduce inventory by size using FIFO
CREATE OR REPLACE FUNCTION reduce_inventory_simple(
    p_size INTEGER,
    p_quantity INTEGER,
    p_order_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_remaining INTEGER := p_quantity;
    v_batch RECORD;
BEGIN
    -- Get batches for this size, ordered by oldest first (FIFO)
    FOR v_batch IN
        SELECT sr.id, sr.total_pieces, sr.total_weight_grams
        FROM sorting_results sr
        JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
        WHERE sr.size_class = p_size 
        AND sb.status = 'completed'
        AND sr.total_pieces > 0
        ORDER BY sb.created_at ASC -- FIFO: oldest first
    LOOP
        IF v_remaining <= 0 THEN
            EXIT;
        END IF;
        
        -- Deduct from this batch
        IF v_batch.total_pieces >= v_remaining THEN
            -- This batch has enough, reduce it
            UPDATE sorting_results 
            SET 
                total_pieces = total_pieces - v_remaining,
                total_weight_grams = ROUND(total_weight_grams * (total_pieces - v_remaining)::DECIMAL / total_pieces),
                updated_at = NOW()
            WHERE id = v_batch.id;
            v_remaining := 0;
        ELSE
            -- This batch doesn't have enough, empty it
            UPDATE sorting_results 
            SET 
                total_pieces = 0,
                total_weight_grams = 0,
                updated_at = NOW()
            WHERE id = v_batch.id;
            v_remaining := v_remaining - v_batch.total_pieces;
        END IF;
    END LOOP;
    
    -- Return true if we reduced all requested quantity
    RETURN v_remaining = 0;
END;
$$ LANGUAGE plpgsql;

-- Simple function to check if we have enough inventory
CREATE OR REPLACE FUNCTION check_inventory_simple(
    p_size INTEGER,
    p_quantity INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_available INTEGER;
BEGIN
    SELECT COALESCE(SUM(sr.total_pieces), 0) INTO v_available
    FROM sorting_results sr
    JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
    WHERE sr.size_class = p_size 
    AND sb.status = 'completed'
    AND sr.total_pieces > 0;
    
    RETURN v_available >= p_quantity;
END;
$$ LANGUAGE plpgsql;

SELECT 'Simple FIFO inventory reduction functions created!' as status;
