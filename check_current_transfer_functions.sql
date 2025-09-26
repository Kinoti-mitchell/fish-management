-- Check Current Transfer Functions
-- This script checks what transfer functions actually exist and work

-- 1. Check what transfer functions exist
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_name LIKE '%transfer%'
AND routine_schema = 'public'
ORDER BY routine_name;

-- 2. Check if approve_transfer function exists and what it does
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'approve_transfer'
AND routine_schema = 'public';

-- 3. Test if we can call the approve_transfer function
-- First, let's see what pending transfers exist
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

-- 4. Check what's in the sorting_results table for the source storage
SELECT 
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sl.name as storage_name,
    sr.created_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name IN ('Processing Area 2', 'test', 'Cold Storage A', 'Cold Storage B')
AND sr.total_weight_grams > 0
ORDER BY sl.name, sr.size_class;
