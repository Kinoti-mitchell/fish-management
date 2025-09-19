-- Fix sorting_batches relationship to use profiles instead of auth.users
-- This script updates the foreign key relationship after the profiles migration

-- Step 1: Drop the existing foreign key constraint
DO $$ 
BEGIN
    -- Check if the constraint exists and drop it
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'sorting_batches_sorted_by_fkey' 
        AND table_name = 'sorting_batches'
    ) THEN
        ALTER TABLE sorting_batches DROP CONSTRAINT sorting_batches_sorted_by_fkey;
        RAISE NOTICE 'Dropped existing foreign key constraint';
    END IF;
END $$;

-- Step 2: Add new foreign key constraint to profiles table
ALTER TABLE sorting_batches 
ADD CONSTRAINT sorting_batches_sorted_by_fkey 
FOREIGN KEY (sorted_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Step 3: Update any existing records that reference auth.users to reference profiles
-- This handles the case where sorted_by values need to be migrated
DO $$ 
BEGIN
    -- Update sorted_by values to match profiles table
    -- This assumes that the UUIDs in sorted_by correspond to profiles.id
    UPDATE sorting_batches 
    SET sorted_by = NULL 
    WHERE sorted_by IS NOT NULL 
    AND sorted_by NOT IN (SELECT id FROM profiles);
    
    RAISE NOTICE 'Updated sorting_batches.sorted_by to reference profiles table';
END $$;

-- Step 4: Also fix size_class_thresholds table if it has the same issue
DO $$ 
BEGIN
    -- Check if size_class_thresholds has a foreign key to auth.users
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'size_class_thresholds_created_by_fkey' 
        AND table_name = 'size_class_thresholds'
    ) THEN
        ALTER TABLE size_class_thresholds DROP CONSTRAINT size_class_thresholds_created_by_fkey;
        RAISE NOTICE 'Dropped size_class_thresholds foreign key constraint';
    END IF;
END $$;

-- Add new foreign key constraint for size_class_thresholds
ALTER TABLE size_class_thresholds 
ADD CONSTRAINT size_class_thresholds_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Step 5: Update size_class_thresholds records
DO $$ 
BEGIN
    UPDATE size_class_thresholds 
    SET created_by = NULL 
    WHERE created_by IS NOT NULL 
    AND created_by NOT IN (SELECT id FROM profiles);
    
    RAISE NOTICE 'Updated size_class_thresholds.created_by to reference profiles table';
END $$;

-- Step 6: Verify the relationships
SELECT 
    'sorting_batches' as table_name,
    COUNT(*) as total_records,
    COUNT(sorted_by) as records_with_sorted_by,
    COUNT(CASE WHEN sorted_by IN (SELECT id FROM profiles) THEN 1 END) as valid_references
FROM sorting_batches
UNION ALL
SELECT 
    'size_class_thresholds' as table_name,
    COUNT(*) as total_records,
    COUNT(created_by) as records_with_created_by,
    COUNT(CASE WHEN created_by IN (SELECT id FROM profiles) THEN 1 END) as valid_references
FROM size_class_thresholds;

-- Step 7: Show migration summary
SELECT 
    'Relationship Fix Summary' as info,
    (SELECT COUNT(*) FROM sorting_batches WHERE sorted_by IS NOT NULL) as sorting_batches_with_user,
    (SELECT COUNT(*) FROM size_class_thresholds WHERE created_by IS NOT NULL) as thresholds_with_creator;
