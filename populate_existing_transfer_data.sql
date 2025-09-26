-- Populate Existing Transfer Data
-- This script extracts size and weight information from the notes field and populates the new columns

-- 1. Update existing transfers with size and weight data extracted from notes
UPDATE transfers 
SET 
    size_class = CASE 
        -- Extract first size from notes like "Sizes: 10, 6" or "Sizes: 0"
        WHEN notes ~ 'Sizes: (\d+)' THEN 
            (regexp_match(notes, 'Sizes: (\d+)'))[1]::INTEGER
        ELSE NULL
    END,
    quantity = CASE 
        -- For now, set quantity to 1 for each transfer (can be adjusted later)
        WHEN notes ~ 'Sizes:' THEN 1
        ELSE NULL
    END,
    weight_kg = CASE 
        -- Try to extract weight from notes if available, otherwise set to 0.1 as placeholder
        WHEN notes ~ 'Sizes:' THEN 0.1
        ELSE NULL
    END
WHERE size_class IS NULL OR quantity IS NULL OR weight_kg IS NULL;

-- 2. Show the updated data
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

-- 3. Check if we need to create separate records for multiple sizes in notes
-- Some notes have "Sizes: 10, 6" which should be two separate transfers
SELECT 
    id,
    notes,
    size_class,
    CASE 
        WHEN notes ~ 'Sizes: (\d+), (\d+)' THEN 'MULTIPLE_SIZES'
        WHEN notes ~ 'Sizes: (\d+)' THEN 'SINGLE_SIZE'
        ELSE 'NO_SIZE_INFO'
    END as size_info_type
FROM transfers 
WHERE notes ~ 'Sizes:'
ORDER BY created_at DESC;
