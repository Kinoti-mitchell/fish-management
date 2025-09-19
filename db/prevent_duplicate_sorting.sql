-- Prevent Duplicate Sorting Operations
-- This script adds comprehensive protection against duplicate sorting

-- Step 1: Check for any existing duplicate sorting batches
SELECT 
    'Checking for existing duplicate sorting batches:' as status,
    processing_record_id,
    COUNT(*) as duplicate_count,
    array_agg(status) as statuses
FROM sorting_batches 
GROUP BY processing_record_id 
HAVING COUNT(*) > 1;

-- Step 2: Add unique constraint to prevent future duplicates
-- This ensures only one completed sorting batch per processing record
ALTER TABLE sorting_batches 
ADD CONSTRAINT IF NOT EXISTS sorting_batches_one_completed_per_processing_record 
UNIQUE (processing_record_id) 
WHERE status = 'completed';

-- Step 3: Create a more comprehensive function to prevent duplicate sorting
CREATE OR REPLACE FUNCTION prevent_duplicate_sorting(p_processing_record_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_existing_batch RECORD;
BEGIN
    -- Check if there's already a completed sorting batch for this processing record
    SELECT * INTO v_existing_batch
    FROM sorting_batches 
    WHERE processing_record_id = p_processing_record_id 
    AND status = 'completed'
    LIMIT 1;
    
    IF FOUND THEN
        RAISE EXCEPTION 'Processing record % has already been sorted (Batch: %)', 
            p_processing_record_id, v_existing_batch.batch_number;
    END IF;
    
    -- Check if there's a pending/in-progress batch that should be completed first
    SELECT * INTO v_existing_batch
    FROM sorting_batches 
    WHERE processing_record_id = p_processing_record_id 
    AND status IN ('pending', 'in_progress')
    LIMIT 1;
    
    IF FOUND THEN
        RAISE EXCEPTION 'Processing record % has a % sorting batch that must be completed first (Batch: %)', 
            p_processing_record_id, v_existing_batch.status, v_existing_batch.batch_number;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create a trigger to automatically prevent duplicate sorting
CREATE OR REPLACE FUNCTION check_duplicate_sorting_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Only check for completed batches
    IF NEW.status = 'completed' THEN
        -- Check if there's already a completed batch for this processing record
        IF EXISTS (
            SELECT 1 FROM sorting_batches 
            WHERE processing_record_id = NEW.processing_record_id 
            AND status = 'completed'
            AND id != NEW.id  -- Exclude the current record being updated
        ) THEN
            RAISE EXCEPTION 'Cannot complete sorting: Processing record % already has a completed sorting batch', 
                NEW.processing_record_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS prevent_duplicate_sorting_trigger ON sorting_batches;

-- Create the trigger
CREATE TRIGGER prevent_duplicate_sorting_trigger
    BEFORE INSERT OR UPDATE ON sorting_batches
    FOR EACH ROW
    EXECUTE FUNCTION check_duplicate_sorting_trigger();

-- Step 5: Create a function to safely create sorting batches
CREATE OR REPLACE FUNCTION create_sorting_batch_safe(
    p_processing_record_id UUID,
    p_batch_number VARCHAR(50),
    p_total_weight_grams DECIMAL,
    p_total_pieces INTEGER,
    p_storage_location_id UUID DEFAULT NULL,
    p_size_distribution JSONB DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_batch_id UUID;
    v_processing_record RECORD;
BEGIN
    -- First, check for duplicates
    PERFORM prevent_duplicate_sorting(p_processing_record_id);
    
    -- Get processing record details
    SELECT * INTO v_processing_record 
    FROM processing_records 
    WHERE id = p_processing_record_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Processing record not found: %', p_processing_record_id;
    END IF;
    
    -- Create sorting batch
    INSERT INTO sorting_batches (
        processing_record_id,
        batch_number,
        total_weight_grams,
        total_pieces,
        sorting_date,
        status,
        storage_location_id,
        size_distribution,
        notes
    ) VALUES (
        p_processing_record_id,
        p_batch_number,
        p_total_weight_grams,
        p_total_pieces,
        NOW(),
        'completed',  -- Mark as completed immediately since we have all the data
        p_storage_location_id,
        p_size_distribution,
        p_notes
    ) RETURNING id INTO v_batch_id;
    
    RETURN v_batch_id;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Verify the constraints and functions
SELECT 
    'Constraint verification:' as status,
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'sorting_batches'::regclass 
AND conname = 'sorting_batches_one_completed_per_processing_record';

-- Step 7: Test the duplicate prevention
SELECT 
    'Functions created successfully:' as status,
    proname as function_name
FROM pg_proc 
WHERE proname IN ('prevent_duplicate_sorting', 'create_sorting_batch_safe', 'check_duplicate_sorting_trigger');

-- Step 8: Show current sorting batches state
SELECT 
    'Current sorting batches state:' as status,
    COUNT(*) as total_batches,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_batches,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_batches,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_batches,
    COUNT(DISTINCT processing_record_id) as unique_processing_records
FROM sorting_batches;
