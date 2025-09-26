-- Check What's Actually Broken
-- This script will show us exactly what's not working

-- 1. Check if approve_transfer function exists
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name = 'approve_transfer'
AND routine_schema = 'public';

-- 2. Check what pending transfers exist
SELECT 
    id,
    from_storage_name,
    to_storage_name,
    size_class,
    quantity,
    weight_kg,
    status,
    created_at
FROM transfers 
WHERE status = 'pending'
ORDER BY created_at DESC;

-- 3. Check what's in sorting_results (the actual inventory)
SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sl.name as storage_name,
    sr.transfer_id,
    sr.transfer_source_storage_name,
    sr.created_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name IN ('Processing Area 2', 'test', 'Cold Storage A', 'Cold Storage B')
AND sr.total_weight_grams > 0
ORDER BY sl.name, sr.size_class;

-- 4. Check if any sorting_results have transfer tracking info
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN transfer_id IS NOT NULL THEN 1 END) as has_transfer_id,
    COUNT(CASE WHEN transfer_source_storage_name IS NOT NULL THEN 1 END) as has_source_storage
FROM sorting_results;
