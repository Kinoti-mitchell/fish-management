-- Fix disposal_records foreign key constraint to reference profiles table instead of auth.users
-- This resolves the error: Key (disposed_by)=(f5946671-9cf8-49e0-b993-e23a07533da8) is not present in table "users"

-- Step 1: Drop the existing foreign key constraints
ALTER TABLE disposal_records DROP CONSTRAINT IF EXISTS disposal_records_disposed_by_fkey;
ALTER TABLE disposal_records DROP CONSTRAINT IF EXISTS disposal_records_approved_by_fkey;

-- Step 2: Update the foreign key constraints to reference profiles table
ALTER TABLE disposal_records 
ADD CONSTRAINT disposal_records_disposed_by_fkey 
FOREIGN KEY (disposed_by) REFERENCES profiles(id);

ALTER TABLE disposal_records 
ADD CONSTRAINT disposal_records_approved_by_fkey 
FOREIGN KEY (approved_by) REFERENCES profiles(id);

-- Step 3: Verify the changes
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
    AND tc.table_name='disposal_records'
    AND (kcu.column_name = 'disposed_by' OR kcu.column_name = 'approved_by');

-- Step 4: Test that the user ID exists in profiles table
SELECT id, email, first_name, last_name, role 
FROM profiles 
WHERE id = 'f5946671-9cf8-49e0-b993-e23a07533da8';

-- Step 5: If the user doesn't exist in profiles, we need to handle this case
-- For now, let's make the disposed_by field nullable to prevent errors
ALTER TABLE disposal_records ALTER COLUMN disposed_by DROP NOT NULL;
ALTER TABLE disposal_records ALTER COLUMN approved_by DROP NOT NULL;

-- Step 6: Add a comment explaining the change
COMMENT ON COLUMN disposal_records.disposed_by IS 'References profiles.id - the user who created the disposal record';
COMMENT ON COLUMN disposal_records.approved_by IS 'References profiles.id - the user who approved the disposal record';
