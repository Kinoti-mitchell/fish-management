-- Test Manual Transfer Approval
-- This will help us see exactly what's happening during approval

-- First, let's see the current state
SELECT 'BEFORE APPROVAL' as status;
SELECT 
    id,
    size_class,
    weight_kg,
    quantity,
    status,
    approved_by,
    approved_at
FROM transfers 
WHERE id = '47803438-31e9-48f0-b9e4-810791cab244';

-- Check inventory before
SELECT 'INVENTORY BEFORE' as status;
SELECT 
    storage_location_id,
    size_class,
    total_pieces,
    (total_weight_grams / 1000.0) as weight_kg
FROM sorting_results 
WHERE storage_location_id = (
    SELECT from_storage_location_id 
    FROM transfers 
    WHERE id = '47803438-31e9-48f0-b9e4-810791cab244'
)
AND size_class = 5;

-- Try to approve the transfer manually
SELECT 'ATTEMPTING APPROVAL' as status;
SELECT * FROM approve_transfer('47803438-31e9-48f0-b9e4-810791cab244', '00000000-0000-0000-0000-000000000000');

-- Check the state after approval attempt
SELECT 'AFTER APPROVAL ATTEMPT' as status;
SELECT 
    id,
    size_class,
    weight_kg,
    quantity,
    status,
    approved_by,
    approved_at,
    completed_at
FROM transfers 
WHERE id = '47803438-31e9-48f0-b9e4-810791cab244';

-- Check inventory after
SELECT 'INVENTORY AFTER' as status;
SELECT 
    storage_location_id,
    size_class,
    total_pieces,
    (total_weight_grams / 1000.0) as weight_kg
FROM sorting_results 
WHERE storage_location_id = (
    SELECT from_storage_location_id 
    FROM transfers 
    WHERE id = '47803438-31e9-48f0-b9e4-810791cab244'
)
AND size_class = 5;
