-- Clean up existing Size 0 transfers with 0kg weight
-- These shouldn't exist and are causing confusion

-- Delete transfers with size 0 and 0kg weight
DELETE FROM transfers 
WHERE size_class = 0 AND weight_kg = 0;

-- Also delete any transfers with 0kg weight (they shouldn't exist)
DELETE FROM transfers 
WHERE weight_kg = 0;

-- Show remaining transfers to verify cleanup
SELECT 
    id,
    from_storage_name,
    to_storage_name,
    size_class,
    weight_kg,
    quantity,
    status,
    created_at
FROM transfers 
ORDER BY created_at DESC
LIMIT 10;

-- Success message
SELECT 'Size 0 transfers cleaned up - removed invalid transfers with 0kg weight!' as status;
