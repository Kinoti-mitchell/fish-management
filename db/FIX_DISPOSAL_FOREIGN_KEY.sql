-- Fix disposal_records foreign key constraint to reference profiles table
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

-- Step 3: Make the fields nullable to prevent errors if user doesn't exist
ALTER TABLE disposal_records ALTER COLUMN disposed_by DROP NOT NULL;
ALTER TABLE disposal_records ALTER COLUMN approved_by DROP NOT NULL;
