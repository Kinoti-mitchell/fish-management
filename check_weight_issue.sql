-- Check Weight Issue in Sorting Results
-- This script investigates why weights are showing as 0.00

-- 1. Check Cold Storage B inventory details (where weight shows 0.00)
SELECT 'Cold Storage B - Detailed Inventory' as check_type;
SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sr.created_at,
    sr.updated_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Cold Storage B'
ORDER BY sr.size_class;

-- 2. Check Processing Area 2 - Size 1 specifically (should have 1208.0kg)
SELECT 'Processing Area 2 - Size 1 Details' as check_type;
SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sr.created_at,
    sr.updated_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name = 'Processing Area 2' AND sr.size_class = 1;

-- 3. Check if there are any records with 0 weight_grams
SELECT 'Records with Zero Weight' as check_type;
SELECT 
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    sr.created_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sr.total_weight_grams = 0 OR sr.total_weight_grams IS NULL
ORDER BY sl.name, sr.size_class;

-- 4. Check the data types and constraints
SELECT 'Data Type Check' as check_type;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sorting_results' 
AND column_name IN ('total_weight_grams', 'total_pieces')
ORDER BY ordinal_position;

-- 5. Check for any recent transfers that might have affected this
SELECT 'Recent Transfers Affecting Cold Storage B' as check_type;
SELECT 
    t.id,
    t.from_storage_name,
    t.to_storage_name,
    t.size_class,
    t.weight_kg,
    t.quantity,
    t.status,
    t.created_at,
    t.approved_at
FROM transfers t
WHERE (t.from_storage_name = 'Cold Storage B' OR t.to_storage_name = 'Cold Storage B')
ORDER BY t.created_at DESC;

-- 6. Check if there are any records with very small weights that might be rounding to 0
SELECT 'Small Weight Records' as check_type;
SELECT 
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    sr.total_weight_grams,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    CASE 
        WHEN sr.total_weight_grams < 1000 THEN 'Less than 1kg'
        WHEN sr.total_weight_grams < 100 THEN 'Less than 0.1kg'
        WHEN sr.total_weight_grams < 10 THEN 'Less than 0.01kg'
        ELSE 'Normal weight'
    END as weight_category
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sr.total_weight_grams > 0 AND sr.total_weight_grams < 1000
ORDER BY sr.total_weight_grams;
