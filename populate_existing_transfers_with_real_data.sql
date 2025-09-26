-- Populate Existing Transfers with Real Data
-- This script extracts the actual size and weight data from sorting_results and populates the transfer records

-- 1. First, let's see what we have in the existing transfers
SELECT 
    id,
    from_storage_name,
    to_storage_name,
    notes,
    size_class,
    quantity,
    weight_kg,
    created_at
FROM transfers 
ORDER BY created_at DESC;

-- 2. Update transfers with actual data from sorting_results
-- For transfers from "Processing Area 2" with sizes 10, 6
UPDATE transfers 
SET 
    size_class = 10,
    quantity = (
        SELECT COALESCE(SUM(sr.total_pieces), 0)
        FROM sorting_results sr
        JOIN storage_locations sl ON sr.storage_location_id = sl.id
        WHERE sl.name = 'Processing Area 2' 
        AND sr.size_class = 10
        AND sr.total_weight_grams > 0
    ),
    weight_kg = (
        SELECT COALESCE(SUM(sr.total_weight_grams) / 1000.0, 0)
        FROM sorting_results sr
        JOIN storage_locations sl ON sr.storage_location_id = sl.id
        WHERE sl.name = 'Processing Area 2' 
        AND sr.size_class = 10
        AND sr.total_weight_grams > 0
    )
WHERE from_storage_name = 'Processing Area 2' 
AND notes LIKE '%Sizes: 10, 6%'
AND size_class IS NULL;

-- 3. Create a second transfer record for size 6 from the same batch
INSERT INTO transfers (
    from_storage_location_id,
    to_storage_location_id,
    from_storage_name,
    to_storage_name,
    size_class,
    quantity,
    weight_kg,
    notes,
    status,
    requested_by,
    created_at,
    updated_at
)
SELECT 
    t.from_storage_location_id,
    t.to_storage_location_id,
    t.from_storage_name,
    t.to_storage_name,
    6 as size_class,
    COALESCE(SUM(sr.total_pieces), 0) as quantity,
    COALESCE(SUM(sr.total_weight_grams) / 1000.0, 0) as weight_kg,
    'Transfer from Processing Area 2 - Size: 6 - No notes' as notes,
    'pending' as status,
    t.requested_by,
    t.created_at,
    t.updated_at
FROM transfers t
JOIN sorting_results sr ON sr.storage_location_id = t.from_storage_location_id
JOIN storage_locations sl ON sl.id = sr.storage_location_id
WHERE t.from_storage_name = 'Processing Area 2' 
AND t.notes LIKE '%Sizes: 10, 6%'
AND sr.size_class = 6
AND sr.total_weight_grams > 0
GROUP BY t.id, t.from_storage_location_id, t.to_storage_location_id, t.from_storage_name, t.to_storage_name, t.requested_by, t.created_at, t.updated_at;

-- 4. Update the "test" storage transfer with actual data
UPDATE transfers 
SET 
    size_class = 0,
    quantity = (
        SELECT COALESCE(SUM(sr.total_pieces), 0)
        FROM sorting_results sr
        JOIN storage_locations sl ON sr.storage_location_id = sl.id
        WHERE sl.name = 'test' 
        AND sr.size_class = 0
        AND sr.total_weight_grams > 0
    ),
    weight_kg = (
        SELECT COALESCE(SUM(sr.total_weight_grams) / 1000.0, 0)
        FROM sorting_results sr
        JOIN storage_locations sl ON sr.storage_location_id = sl.id
        WHERE sl.name = 'test' 
        AND sr.size_class = 0
        AND sr.total_weight_grams > 0
    )
WHERE from_storage_name = 'test' 
AND notes LIKE '%Sizes: 0%'
AND size_class IS NULL;

-- 5. Show the updated data
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

-- 6. Verify the data matches what's in sorting_results
SELECT 
    'sorting_results' as source,
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces as quantity,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name IN ('Processing Area 2', 'test')
AND sr.total_weight_grams > 0
ORDER BY sl.name, sr.size_class;
