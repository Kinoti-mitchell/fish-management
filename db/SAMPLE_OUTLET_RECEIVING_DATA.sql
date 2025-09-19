-- Sample Data for Testing Outlet Receiving
-- This creates sample data to test the outlet receiving functionality

-- First, let's create some sample outlets if they don't exist
INSERT INTO outlets (id, name, location, phone, manager_name, status)
VALUES 
    ('outlet-001', 'Nakuru Fresh Fish Market', 'Nakuru', '+254 700 123 456', 'John Kamau', 'active'),
    ('outlet-002', 'Kisumu Central Market', 'Kisumu', '+254 700 234 567', 'Mary Akinyi', 'active'),
    ('outlet-003', 'Nairobi Fish Market', 'Nairobi', '+254 700 345 678', 'Peter Mwangi', 'active')
ON CONFLICT (id) DO NOTHING;

-- Create sample outlet orders
INSERT INTO outlet_orders (
    id, 
    outlet_id, 
    order_date, 
    delivery_date, 
    total_value, 
    status, 
    order_number,
    created_by
)
VALUES 
    ('order-001', 'outlet-001', '2024-01-15', '2024-01-16', 50000, 'confirmed', 'ORD-001', (SELECT id FROM profiles LIMIT 1)),
    ('order-002', 'outlet-002', '2024-01-15', '2024-01-16', 75000, 'confirmed', 'ORD-002', (SELECT id FROM profiles LIMIT 1)),
    ('order-003', 'outlet-003', '2024-01-15', '2024-01-17', 60000, 'confirmed', 'ORD-003', (SELECT id FROM profiles LIMIT 1))
ON CONFLICT (id) DO NOTHING;

-- Create sample dispatch records
INSERT INTO dispatch_records (
    id,
    outlet_order_id,
    destination,
    dispatch_date,
    dispatched_by,
    total_weight,
    total_pieces,
    size_breakdown,
    total_value,
    status,
    notes
)
VALUES 
    (
        'dispatch-001',
        'order-001',
        'Nakuru',
        '2024-01-16',
        (SELECT id FROM profiles LIMIT 1),
        100.5,
        150,
        '{"3": 50, "4": 60, "5": 40}',
        50000,
        'dispatched',
        'Dispatched to Nakuru Fresh Fish Market'
    ),
    (
        'dispatch-002',
        'order-002',
        'Kisumu',
        '2024-01-16',
        (SELECT id FROM profiles LIMIT 1),
        125.0,
        200,
        '{"3": 80, "4": 70, "5": 50}',
        75000,
        'dispatched',
        'Dispatched to Kisumu Central Market'
    ),
    (
        'dispatch-003',
        'order-003',
        'Nairobi',
        '2024-01-17',
        (SELECT id FROM profiles LIMIT 1),
        90.0,
        120,
        '{"3": 40, "4": 50, "5": 30}',
        60000,
        'dispatched',
        'Dispatched to Nairobi Fish Market'
    )
ON CONFLICT (id) DO NOTHING;

-- Create sample outlet receiving records
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
VALUES 
    (
        'receiving-001',
        'dispatch-001',
        'order-001',
        '2024-01-16',
        (SELECT id FROM profiles LIMIT 1),
        100.5,
        98.5,
        150,
        145,
        50000,
        49000,
        'good',
        '{"3": -2, "4": -3, "5": -2}',
        'Minor weight loss during transport',
        'confirmed',
        'Nakuru Fresh Fish Market',
        'Nakuru'
    ),
    (
        'receiving-002',
        'dispatch-002',
        'order-002',
        '2024-01-16',
        (SELECT id FROM profiles LIMIT 1),
        125.0,
        123.5,
        200,
        195,
        75000,
        74000,
        'excellent',
        '{"3": -1, "4": -2, "5": -2}',
        'Excellent condition, minor weight loss',
        'confirmed',
        'Kisumu Central Market',
        'Kisumu'
    ),
    (
        'receiving-003',
        'dispatch-003',
        'order-003',
        '2024-01-17',
        (SELECT id FROM profiles LIMIT 1),
        90.0,
        88.0,
        120,
        115,
        60000,
        59000,
        'fair',
        '{"3": -2, "4": -2, "5": -1}',
        'Some weight loss, fish condition fair',
        'confirmed',
        'Nairobi Fish Market',
        'Nairobi'
    )
ON CONFLICT (id) DO NOTHING;

-- Verify the data was created
SELECT 'Outlets created:' as info, COUNT(*) as count FROM outlets
UNION ALL
SELECT 'Orders created:', COUNT(*) FROM outlet_orders
UNION ALL
SELECT 'Dispatches created:', COUNT(*) FROM dispatch_records
UNION ALL
SELECT 'Receiving records created:', COUNT(*) FROM outlet_receiving;
