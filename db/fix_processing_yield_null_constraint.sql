-- Fix Processing Yield Null Constraint Violation
-- This script addresses the ERROR: 23502 null value in column "processing_yield" violation

-- Step 1: Check current state of processing_yield column
SELECT 
    'Current processing_yield analysis:' as analysis,
    COUNT(*) as total_records,
    COUNT(processing_yield) as records_with_yield,
    COUNT(CASE WHEN processing_yield IS NULL THEN 1 END) as records_with_null_yield,
    AVG(processing_yield) as avg_yield,
    MIN(processing_yield) as min_yield,
    MAX(processing_yield) as max_yield
FROM processing_records;

-- Step 2: Show records with null processing_yield
SELECT 
    'Records with null processing_yield:' as issue,
    id,
    pre_processing_weight,
    post_processing_weight,
    processing_waste,
    processing_yield,
    created_at
FROM processing_records 
WHERE processing_yield IS NULL
ORDER BY created_at DESC;

-- Step 3: Create function to calculate processing yield
CREATE OR REPLACE FUNCTION calculate_processing_yield(
    p_pre_weight DECIMAL(10,2),
    p_post_weight DECIMAL(10,2)
) RETURNS DECIMAL(5,2) AS $$
BEGIN
    -- Processing yield = (post_processing_weight / pre_processing_weight) * 100
    -- Ensure we don't divide by zero
    IF p_pre_weight IS NULL OR p_pre_weight <= 0 THEN
        RETURN NULL;
    END IF;
    
    IF p_post_weight IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Calculate yield percentage (typically 80-95% for fish processing)
    RETURN ROUND((p_post_weight / p_pre_weight) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Step 4: Update existing records with null processing_yield
UPDATE processing_records 
SET 
    processing_yield = calculate_processing_yield(pre_processing_weight, post_processing_weight),
    updated_at = NOW()
WHERE processing_yield IS NULL
AND pre_processing_weight IS NOT NULL 
AND pre_processing_weight > 0
AND post_processing_weight IS NOT NULL;

-- Step 5: Create trigger function to auto-calculate processing_yield
CREATE OR REPLACE FUNCTION auto_calculate_processing_yield()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-calculate processing_yield if it's null or if weights have changed
    IF NEW.processing_yield IS NULL OR 
       (OLD.pre_processing_weight IS DISTINCT FROM NEW.pre_processing_weight) OR
       (OLD.post_processing_weight IS DISTINCT FROM NEW.post_processing_weight) THEN
        
        NEW.processing_yield := calculate_processing_yield(
            NEW.pre_processing_weight, 
            NEW.post_processing_weight
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger for auto-calculation
DROP TRIGGER IF EXISTS trigger_auto_calculate_processing_yield ON processing_records;
CREATE TRIGGER trigger_auto_calculate_processing_yield
    BEFORE INSERT OR UPDATE ON processing_records
    FOR EACH ROW
    EXECUTE FUNCTION auto_calculate_processing_yield();

-- Step 7: Verify the fix worked
SELECT 
    'AFTER FIX - Processing_yield analysis:' as analysis,
    COUNT(*) as total_records,
    COUNT(processing_yield) as records_with_yield,
    COUNT(CASE WHEN processing_yield IS NULL THEN 1 END) as records_with_null_yield,
    ROUND(AVG(processing_yield), 2) as avg_yield,
    ROUND(MIN(processing_yield), 2) as min_yield,
    ROUND(MAX(processing_yield), 2) as max_yield
FROM processing_records;

-- Step 8: Show sample of updated records
SELECT 
    'Sample of updated records:' as sample,
    id,
    pre_processing_weight,
    post_processing_weight,
    processing_waste,
    processing_yield,
    ROUND((post_processing_weight / pre_processing_weight) * 100, 2) as calculated_yield,
    created_at
FROM processing_records 
WHERE processing_yield IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- Step 9: Test the trigger with a sample insert (commented out to avoid creating test data)
/*
INSERT INTO processing_records (
    processing_date, 
    pre_processing_weight, 
    post_processing_weight, 
    processing_waste,
    warehouse_entry_id,
    processed_by
) VALUES (
    CURRENT_DATE, 
    30.0, 
    27.0, 
    3.0,
    (SELECT id FROM warehouse_entries LIMIT 1),
    (SELECT id FROM profiles LIMIT 1)
);
*/

-- Step 10: Show final status
SELECT 
    'Processing yield null constraint fix completed!' as status,
    COUNT(*) as total_records,
    COUNT(CASE WHEN processing_yield IS NULL THEN 1 END) as remaining_null_yields
FROM processing_records;

-- Step 11: Validation - ensure no null processing_yield values remain
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count 
    FROM processing_records 
    WHERE processing_yield IS NULL;
    
    IF null_count > 0 THEN
        RAISE WARNING 'Warning: % records still have null processing_yield values', null_count;
    ELSE
        RAISE NOTICE 'Success: All processing records now have processing_yield values';
    END IF;
END $$;
