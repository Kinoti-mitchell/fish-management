-- Fix Outlet Receiving Foreign Key Reference
-- This script updates the outlet_receiving table to reference profiles instead of users

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE outlet_receiving DROP CONSTRAINT IF EXISTS outlet_receiving_received_by_fkey;

-- Step 2: Add the new foreign key constraint to reference profiles
ALTER TABLE outlet_receiving 
ADD CONSTRAINT outlet_receiving_received_by_fkey 
FOREIGN KEY (received_by) REFERENCES profiles(id);

-- Step 3: Verify the constraint was created
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name='outlet_receiving'
AND kcu.column_name = 'received_by';
