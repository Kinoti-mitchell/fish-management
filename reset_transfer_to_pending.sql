-- Reset ALL transfers in the bulk transfer batch back to pending
-- This batch has 4 individual transfers that represent one bulk transfer
UPDATE transfers 
SET 
    status = 'pending',
    approved_by = NULL,
    approved_at = NULL,
    completed_at = NULL,
    updated_at = NOW()
WHERE 
    from_storage_name = 'Cold Storage A'
    AND to_storage_name = 'storage 1'
    AND notes = 'Transfer from Cold Storage A - Sizes: 10, 3, 5, 9 - No notes'
    AND created_at = '2025-09-18 13:05:14.045467+00'
    AND status IN ('approved', 'completed');

-- Verify all transfers in the batch are now pending
SELECT 
    id,
    from_storage_name,
    to_storage_name,
    size_class,
    weight_kg,
    quantity,
    status,
    notes,
    created_at,
    approved_at,
    completed_at
FROM transfers 
WHERE 
    from_storage_name = 'Cold Storage A'
    AND to_storage_name = 'storage 1'
    AND notes = 'Transfer from Cold Storage A - Sizes: 10, 3, 5, 9 - No notes'
    AND created_at = '2025-09-18 13:05:14.045467+00'
ORDER BY size_class;
