-- Test Outlet Receiving Workflow
-- This tests the complete workflow from dispatch to receiving confirmation

-- Step 1: Create a test outlet receiving record with 'pending' status
INSERT INTO outlet_receiving (
    id,
    dispatch_id,
    outlet_order_id,
    received_date,
    received_by,
    expected_weight,
    actual_weight_received,
    expected_pieces,
    actual_pieces_received,
    expected_value,
    actual_value_received,
    condition,
    size_discrepancies,
    discrepancy_notes,
    status,
    outlet_name,
    outlet_location
)
VALUES (
    'test-receiving-001',
    (SELECT id FROM dispatch_records LIMIT 1), -- Use existing dispatch
    (SELECT outlet_order_id FROM dispatch_records LIMIT 1), -- Use existing order
    CURRENT_DATE,
    (SELECT id FROM profiles LIMIT 1),
    100.0,
    98.5,
    150,
    145,
    50000,
    49000,
    'good',
    '{"3": -2, "4": -3, "5": -2}',
    'Test receiving record - minor weight loss',
    'pending', -- Start with pending status
    'Test Outlet',
    'Test Location'
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Check that no inventory record was created yet (status is pending)
SELECT 
    'Before confirmation - outlet_receiving_inventory count:' as status,
    COUNT(*) as count 
FROM outlet_receiving_inventory 
WHERE outlet_receiving_id = 'test-receiving-001';

-- Step 3: Update the status to 'confirmed' to trigger the inventory creation
UPDATE outlet_receiving 
SET status = 'confirmed' 
WHERE id = 'test-receiving-001';

-- Step 4: Check that inventory record was created after confirmation
SELECT 
    'After confirmation - outlet_receiving_inventory count:' as status,
    COUNT(*) as count 
FROM outlet_receiving_inventory 
WHERE outlet_receiving_id = 'test-receiving-001';

-- Step 5: Show the created inventory record
SELECT 
    'Created inventory record:' as info,
    outlet_receiving_id,
    fish_type,
    quantity,
    total_weight,
    outlet_name,
    received_date,
    created_at
FROM outlet_receiving_inventory 
WHERE outlet_receiving_id = 'test-receiving-001';

-- Step 6: Clean up test data
DELETE FROM outlet_receiving_inventory WHERE outlet_receiving_id = 'test-receiving-001';
DELETE FROM outlet_receiving WHERE id = 'test-receiving-001';
