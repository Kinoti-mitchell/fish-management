-- Extract Transfer Data from Notes
-- This script extracts size and weight information from the notes field and populates the new columns

-- 1. First, let's see what's in the notes field
SELECT 
    id,
    notes,
    from_storage_name,
    to_storage_name
FROM transfers 
WHERE notes IS NOT NULL
ORDER BY created_at DESC;

-- 2. Update transfers with extracted size data
UPDATE transfers 
SET 
    size_class = CASE 
        -- Extract first size from notes like "Sizes: 10, 6" -> get 10
        WHEN notes ~ 'Sizes: (\d+)' THEN 
            (regexp_match(notes, 'Sizes: (\d+)'))[1]::INTEGER
        ELSE NULL
    END
WHERE size_class IS NULL AND notes ~ 'Sizes:';

-- 3. Update transfers with estimated weight data
-- Since we don't have actual weights in notes, we'll use estimated weights based on size
UPDATE transfers 
SET 
    weight_kg = CASE 
        WHEN size_class = 0 THEN 0.2
        WHEN size_class = 1 THEN 0.3
        WHEN size_class = 2 THEN 0.4
        WHEN size_class = 3 THEN 0.5
        WHEN size_class = 4 THEN 0.6
        WHEN size_class = 5 THEN 0.7
        WHEN size_class = 6 THEN 0.8
        WHEN size_class = 7 THEN 0.9
        WHEN size_class = 8 THEN 1.0
        WHEN size_class = 9 THEN 1.1
        WHEN size_class = 10 THEN 1.2
        ELSE 0.5
    END,
    quantity = 1  -- Set quantity to 1 for each transfer
WHERE weight_kg IS NULL AND size_class IS NOT NULL;

-- 4. Show the updated data
SELECT 
    id,
    from_storage_name,
    to_storage_name,
    size_class,
    quantity,
    weight_kg,
    notes,
    status,
    created_at
FROM transfers 
ORDER BY created_at DESC;

-- 5. Check for transfers with multiple sizes in notes that need to be split
SELECT 
    id,
    notes,
    size_class,
    CASE 
        WHEN notes ~ 'Sizes: (\d+), (\d+)' THEN 
            'NEEDS_SPLITTING: ' || (regexp_match(notes, 'Sizes: (\d+), (\d+)'))[1] || ' and ' || (regexp_match(notes, 'Sizes: (\d+), (\d+)'))[2]
        ELSE 'OK'
    END as action_needed
FROM transfers 
WHERE notes ~ 'Sizes:'
ORDER BY created_at DESC;
