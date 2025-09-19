-- Create sorting_results records from sorting_batches size_distribution
-- This fixes the missing sorting_results that inventory needs

-- Function to create sorting_results from sorting_batches size_distribution
CREATE OR REPLACE FUNCTION create_sorting_results_from_batch(
    p_sorting_batch_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_batch RECORD;
    v_size_key TEXT;
    v_quantity INTEGER;
    v_weight_per_fish DECIMAL(10,2);
    v_total_weight_grams DECIMAL(10,2);
BEGIN
    -- Get the sorting batch
    SELECT * INTO v_batch FROM sorting_batches WHERE id = p_sorting_batch_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sorting batch not found: %', p_sorting_batch_id;
    END IF;
    
    IF v_batch.status != 'completed' THEN
        RAISE EXCEPTION 'Sorting batch must be completed. Current status: %', v_batch.status;
    END IF;
    
    -- Check if sorting_results already exist for this batch
    IF EXISTS (SELECT 1 FROM sorting_results WHERE sorting_batch_id = p_sorting_batch_id) THEN
        RAISE NOTICE 'Sorting results already exist for batch %', p_sorting_batch_id;
        RETURN TRUE;
    END IF;
    
    -- Process each size in the size_distribution
    FOR v_size_key, v_quantity IN 
        SELECT key, value::INTEGER 
        FROM jsonb_each_text(v_batch.size_distribution)
        WHERE value::INTEGER > 0
    LOOP
        -- Calculate weight per fish based on size class
        v_weight_per_fish := CASE v_size_key::INTEGER
            WHEN 0 THEN 0.2  -- Small fish
            WHEN 1 THEN 0.3
            WHEN 2 THEN 0.4
            WHEN 3 THEN 0.5
            WHEN 4 THEN 0.6
            WHEN 5 THEN 0.7
            WHEN 6 THEN 0.8
            WHEN 7 THEN 0.9
            WHEN 8 THEN 1.0
            WHEN 9 THEN 1.1
            WHEN 10 THEN 1.2  -- Large fish
            ELSE 0.5
        END;
        
        v_total_weight_grams := v_quantity * v_weight_per_fish * 1000; -- Convert to grams
        
        -- Insert sorting result
        INSERT INTO sorting_results (
            sorting_batch_id,
            size_class,
            total_pieces,
            total_weight_grams,
            average_weight_grams,
            grade_distribution,
            storage_location_id,
            created_at,
            updated_at
        ) VALUES (
            p_sorting_batch_id,
            v_size_key::INTEGER,
            v_quantity,
            v_total_weight_grams,
            v_weight_per_fish * 1000, -- Average weight in grams
            '{"B": 1}'::JSONB, -- Default grade
            v_batch.storage_location_id,
            v_batch.created_at,
            NOW()
        );
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to create sorting_results for all existing sorting_batches
CREATE OR REPLACE FUNCTION create_sorting_results_for_all_batches()
RETURNS TABLE(
    batch_id UUID,
    batch_number TEXT,
    results_created INTEGER,
    status TEXT
) AS $$
DECLARE
    v_batch RECORD;
    v_results_count INTEGER;
BEGIN
    -- Process all completed sorting batches that don't have sorting_results
    FOR v_batch IN
        SELECT sb.id, sb.batch_number, sb.size_distribution
        FROM sorting_batches sb
        WHERE sb.status = 'completed'
        AND sb.size_distribution IS NOT NULL
        AND sb.size_distribution != '{}'::JSONB
        AND NOT EXISTS (
            SELECT 1 FROM sorting_results sr 
            WHERE sr.sorting_batch_id = sb.id
        )
        ORDER BY sb.created_at
    LOOP
        BEGIN
            -- Create sorting results for this batch
            PERFORM create_sorting_results_from_batch(v_batch.id);
            
            -- Count how many results were created
            SELECT COUNT(*) INTO v_results_count
            FROM sorting_results
            WHERE sorting_batch_id = v_batch.id;
            
            RETURN QUERY SELECT 
                v_batch.id,
                v_batch.batch_number,
                v_results_count,
                'SUCCESS'::TEXT;
                
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT 
                v_batch.id,
                v_batch.batch_number,
                0,
                'ERROR: ' || SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Update the sorting process to automatically create sorting_results
CREATE OR REPLACE FUNCTION auto_create_sorting_results()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create sorting_results when a batch is marked as completed
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Create sorting_results from size_distribution
        PERFORM create_sorting_results_from_batch(NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create sorting_results when batch is completed
DROP TRIGGER IF EXISTS trigger_auto_create_sorting_results ON sorting_batches;
CREATE TRIGGER trigger_auto_create_sorting_results
    AFTER UPDATE ON sorting_batches
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_sorting_results();

-- Run the function to create sorting_results for existing batches
SELECT 'Creating sorting_results for existing batches...' as status;
SELECT * FROM create_sorting_results_for_all_batches();

SELECT 'Sorting results creation system installed successfully!' as status;
