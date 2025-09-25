-- Debug Transfer Approval Issue
-- This script will help us understand why transfers stay pending after approval

-- 1. Check what approval functions currently exist
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%transfer%'
ORDER BY routine_name;

-- 2. Check the current status of your transfers
SELECT 
    id,
    from_storage_name,
    to_storage_name,
    size_class,
    weight_kg,
    quantity,
    status,
    approved_by,
    approved_at,
    completed_at,
    created_at,
    notes
FROM transfers 
WHERE 
    from_storage_name = 'Cold Storage A'
    AND to_storage_name = 'storage 1'
    AND notes = 'Transfer from Cold Storage A - Sizes: 10, 3, 5, 9 - No notes'
ORDER BY size_class;

-- 3. Check if there's inventory available for the transfer
SELECT 
    storage_location_id,
    size_class,
    total_pieces,
    total_weight_grams,
    (total_weight_grams / 1000.0) as weight_kg
FROM sorting_results 
WHERE storage_location_id IN (
    SELECT DISTINCT from_storage_location_id 
    FROM transfers 
    WHERE from_storage_name = 'Cold Storage A'
)
AND size_class IN (3, 5, 9, 10)
ORDER BY storage_location_id, size_class;

-- 4. Test the approval function manually (replace with actual transfer ID)
-- SELECT * FROM approve_transfer('47803438-31e9-48f0-b9e4-810791cab244', '00000000-0000-0000-0000-000000000000');

-- 5. Check if there are any error logs or constraints that might be failing
SELECT 
    schemaname,
    tablename,
    constraintname,
    constrainttype
FROM pg_constraint 
WHERE tablename IN ('transfers', 'sorting_results')
AND schemaname = 'public';
