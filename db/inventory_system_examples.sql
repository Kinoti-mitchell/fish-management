-- Inventory System Examples and Test Scenarios
-- This file demonstrates how to use the inventory system

-- ==============================================
-- EXAMPLE 1: Adding Stock to Inventory
-- ==============================================

-- Add 25 pieces of size 3 fish
SELECT * FROM add_stock(
    p_size := 3,
    p_quantity := 25,
    p_entry_type := 'inbound',
    p_notes := 'New shipment from Farmer John'
);

-- Add 15 pieces of size 1 fish (new size)
SELECT * FROM add_stock(
    p_size := 1,
    p_quantity := 15,
    p_entry_type := 'inbound',
    p_notes := 'First shipment of size 1 fish'
);

-- ==============================================
-- EXAMPLE 2: Creating Orders
-- ==============================================

-- Create an order for "Fresh Fish Market" with multiple items
SELECT * FROM create_order(
    p_outlet_name := 'Fresh Fish Market',
    p_items := '[
        {"size": 3, "quantity": 20, "unit_price": 15.50},
        {"size": 4, "quantity": 10, "unit_price": 18.00},
        {"size": 5, "quantity": 5, "unit_price": 22.00}
    ]'::JSONB,
    p_notes := 'Weekly order for weekend sale'
);

-- Create another order for "City Seafood"
SELECT * FROM create_order(
    p_outlet_name := 'City Seafood',
    p_items := '[
        {"size": 2, "quantity": 30, "unit_price": 12.00},
        {"size": 3, "quantity": 15, "unit_price": 15.50}
    ]'::JSONB,
    p_notes := 'Regular weekly order'
);

-- ==============================================
-- EXAMPLE 3: Viewing Current Inventory
-- ==============================================

-- Get all current inventory totals
SELECT * FROM get_inventory_totals();

-- ==============================================
-- EXAMPLE 4: Viewing Movement History
-- ==============================================

-- Get recent inventory movements (all sizes)
SELECT * FROM get_inventory_history(p_limit := 20);

-- Get movement history for size 3 only
SELECT * FROM get_inventory_history(p_size := 3, p_limit := 10);

-- ==============================================
-- EXAMPLE 5: Safe Order Dispatch
-- ==============================================

-- First, let's see what orders we have
SELECT id, outlet_name, status, total_value FROM orders ORDER BY created_at DESC;

-- Dispatch the first order (should succeed if sufficient stock)
SELECT * FROM dispatch_order(
    (SELECT id FROM orders WHERE outlet_name = 'Fresh Fish Market' ORDER BY created_at DESC LIMIT 1)
);

-- Dispatch the second order
SELECT * FROM dispatch_order(
    (SELECT id FROM orders WHERE outlet_name = 'City Seafood' ORDER BY created_at DESC LIMIT 1)
);

-- ==============================================
-- EXAMPLE 6: Viewing Order Details
-- ==============================================

-- Get details for a specific order
SELECT * FROM get_order_details(
    (SELECT id FROM orders WHERE outlet_name = 'Fresh Fish Market' ORDER BY created_at DESC LIMIT 1)
);

-- ==============================================
-- EXAMPLE 7: Testing Insufficient Stock Scenario
-- ==============================================

-- Create an order that will fail due to insufficient stock
SELECT * FROM create_order(
    p_outlet_name := 'Test Outlet',
    p_items := '[
        {"size": 3, "quantity": 200, "unit_price": 15.50}
    ]'::JSONB,
    p_notes := 'This order should fail - not enough stock'
);

-- Try to dispatch it (should fail)
SELECT * FROM dispatch_order(
    (SELECT id FROM orders WHERE outlet_name = 'Test Outlet' ORDER BY created_at DESC LIMIT 1)
);

-- ==============================================
-- EXAMPLE 8: Complex Workflow - Complete Example
-- ==============================================

-- Step 1: Add more stock
SELECT * FROM add_stock(3, 50, 'inbound', NULL, 'Emergency restock');

-- Step 2: Create a large order
SELECT * FROM create_order(
    p_outlet_name := 'Mega Fish Store',
    p_items := '[
        {"size": 1, "quantity": 10, "unit_price": 10.00},
        {"size": 2, "quantity": 20, "unit_price": 12.00},
        {"size": 3, "quantity": 30, "unit_price": 15.50},
        {"size": 4, "quantity": 15, "unit_price": 18.00},
        {"size": 5, "quantity": 8, "unit_price": 22.00}
    ]'::JSONB,
    p_notes := 'Large order for grand opening'
);

-- Step 3: Check current inventory before dispatch
SELECT 'BEFORE DISPATCH' as status, * FROM get_inventory_totals() ORDER BY size;

-- Step 4: Dispatch the order
SELECT * FROM dispatch_order(
    (SELECT id FROM orders WHERE outlet_name = 'Mega Fish Store' ORDER BY created_at DESC LIMIT 1)
);

-- Step 5: Check inventory after dispatch
SELECT 'AFTER DISPATCH' as status, * FROM get_inventory_totals() ORDER BY size;

-- Step 6: View the movement history
SELECT * FROM get_inventory_history(p_limit := 15) ORDER BY created_at DESC;

-- ==============================================
-- EXAMPLE 9: Reporting Queries
-- ==============================================

-- Get all orders with their status
SELECT 
    o.id,
    o.outlet_name,
    o.order_date,
    o.status,
    o.total_value,
    COUNT(oi.id) as item_count,
    SUM(oi.quantity) as total_quantity
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, o.outlet_name, o.order_date, o.status, o.total_value
ORDER BY o.order_date DESC;

-- Get inventory summary with movement counts
SELECT 
    i.size,
    i.quantity as current_stock,
    COUNT(ie.id) as total_movements,
    SUM(CASE WHEN ie.quantity_change > 0 THEN ie.quantity_change ELSE 0 END) as total_inbound,
    SUM(CASE WHEN ie.quantity_change < 0 THEN ABS(ie.quantity_change) ELSE 0 END) as total_outbound
FROM inventory i
LEFT JOIN inventory_entries ie ON i.size = ie.size
GROUP BY i.size, i.quantity
ORDER BY i.size;

-- Get failed orders
SELECT 
    o.id,
    o.outlet_name,
    o.order_date,
    o.total_value,
    o.notes
FROM orders o
WHERE o.status = 'failed'
ORDER BY o.order_date DESC;

-- ==============================================
-- EXAMPLE 10: Manual Queries for Direct Access
-- ==============================================

-- Direct inventory query
SELECT * FROM inventory ORDER BY size;

-- Direct inventory entries query
SELECT * FROM inventory_entries ORDER BY created_at DESC LIMIT 20;

-- Direct orders query
SELECT * FROM orders ORDER BY order_date DESC;

-- Direct order items query
SELECT 
    oi.*,
    o.outlet_name,
    o.status as order_status
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
ORDER BY oi.created_at DESC;

-- ==============================================
-- CLEANUP QUERIES (for testing)
-- ==============================================

-- Uncomment these to reset the system for testing
/*
-- Delete all test data
DELETE FROM inventory_entries WHERE notes LIKE '%test%' OR notes LIKE '%Test%';
DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE outlet_name LIKE '%Test%');
DELETE FROM orders WHERE outlet_name LIKE '%Test%';

-- Reset inventory to initial state
UPDATE inventory SET quantity = 0 WHERE size IN (1,2,3,4,5);
INSERT INTO inventory_entries (size, quantity_change, entry_type, notes) VALUES 
(1, 50, 'inbound', 'Reset - Initial stock'),
(2, 75, 'inbound', 'Reset - Initial stock'),
(3, 100, 'inbound', 'Reset - Initial stock'),
(4, 60, 'inbound', 'Reset - Initial stock'),
(5, 40, 'inbound', 'Reset - Initial stock');
UPDATE inventory SET quantity = 50 WHERE size = 1;
UPDATE inventory SET quantity = 75 WHERE size = 2;
UPDATE inventory SET quantity = 100 WHERE size = 3;
UPDATE inventory SET quantity = 60 WHERE size = 4;
UPDATE inventory SET quantity = 40 WHERE size = 5;
*/
