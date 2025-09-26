-- Check Transfer Data Quality
-- This script verifies that size classes and weights are properly populated

-- 1. First, check what columns actually exist in the transfers table
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'transfers' 
ORDER BY ordinal_position;

-- 2. Check all transfers with their available data
SELECT 
    id,
    from_storage_name,
    to_storage_name,
    quantity,
    weight_kg,
    status,
    notes,
    created_at
FROM transfers 
ORDER BY created_at DESC
LIMIT 20;

-- 3. Check for any transfers with missing or zero weights
SELECT 
    COUNT(*) as total_transfers,
    COUNT(CASE WHEN weight_kg IS NULL OR weight_kg = 0 THEN 1 END) as zero_weight_transfers,
    COUNT(CASE WHEN from_storage_name = 'Unknown' OR from_storage_name IS NULL THEN 1 END) as unknown_from_storage,
    COUNT(CASE WHEN to_storage_name = 'Unknown' OR to_storage_name IS NULL THEN 1 END) as unknown_to_storage
FROM transfers;

-- 4. Check quantity and weight distribution
SELECT 
    COUNT(*) as total_transfers,
    SUM(quantity) as total_quantity,
    SUM(weight_kg) as total_weight_kg,
    AVG(weight_kg) as avg_weight_per_transfer,
    MIN(weight_kg) as min_weight,
    MAX(weight_kg) as max_weight
FROM transfers 
WHERE weight_kg > 0;

-- 5. Check storage name population
SELECT 
    from_storage_name,
    to_storage_name,
    COUNT(*) as transfer_count
FROM transfers 
GROUP BY from_storage_name, to_storage_name
ORDER BY transfer_count DESC;

-- 6. Check recent transfers (last 10) for data quality
SELECT 
    id,
    from_storage_name,
    to_storage_name,
    quantity,
    weight_kg,
    status,
    created_at,
    CASE 
        WHEN weight_kg > 0 AND from_storage_name != 'Unknown' AND to_storage_name != 'Unknown' 
        THEN 'GOOD' 
        ELSE 'NEEDS_FIX' 
    END as data_quality
FROM transfers 
ORDER BY created_at DESC
LIMIT 10;
