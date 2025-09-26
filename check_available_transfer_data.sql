-- Check Available Transfer Data
-- This script shows what size classes and weights are actually available for transfer

-- 1. Check what inventory data is available in sorting_results (the source of transfer data)
SELECT 
    sr.size_class,
    COUNT(*) as batch_count,
    SUM(sr.total_pieces) as total_pieces,
    SUM(sr.total_weight_grams) as total_weight_grams,
    ROUND(SUM(sr.total_weight_grams) / 1000.0, 2) as total_weight_kg,
    ROUND(AVG(sr.total_weight_grams) / 1000.0, 2) as avg_weight_kg,
    sl.name as storage_name
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sr.total_weight_grams > 0
GROUP BY sr.size_class, sl.name
ORDER BY sr.size_class, sl.name;

-- 2. Check what's in Processing Area 2 (where the transfer came from)
SELECT 
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sl.name as storage_name,
    sr.created_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Processing Area 2'
AND sr.total_weight_grams > 0
ORDER BY sr.size_class;

-- 3. Check what's in "test" storage (where the other transfer came from)
SELECT 
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sl.name as storage_name,
    sr.created_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'test'
AND sr.total_weight_grams > 0
ORDER BY sr.size_class;

-- 4. Check all storage locations and their inventory
SELECT 
    sl.name as storage_name,
    sl.location_type,
    COUNT(sr.id) as inventory_items,
    SUM(sr.total_pieces) as total_pieces,
    ROUND(SUM(sr.total_weight_grams) / 1000.0, 2) as total_weight_kg
FROM storage_locations sl
LEFT JOIN sorting_results sr ON sl.id = sr.storage_location_id AND sr.total_weight_grams > 0
GROUP BY sl.id, sl.name, sl.location_type
ORDER BY sl.name;

-- 5. Show the actual transfer notes to understand what was selected
SELECT 
    id,
    from_storage_name,
    to_storage_name,
    notes,
    created_at
FROM transfers 
WHERE notes IS NOT NULL
ORDER BY created_at DESC;
