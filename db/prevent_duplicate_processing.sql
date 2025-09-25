-- Prevent Duplicate Processing Records
-- This script adds a unique constraint to prevent the same warehouse entry from being processed multiple times

-- Step 1: Check for any existing duplicate processing records
SELECT 
    'Checking for existing duplicates:' as status,
    warehouse_entry_id,
    COUNT(*) as duplicate_count
FROM processing_records 
GROUP BY warehouse_entry_id 
HAVING COUNT(*) > 1;

-- Step 2: If duplicates exist, we need to handle them first
-- For now, we'll keep the most recent processing record and remove older duplicates
WITH duplicates AS (
    SELECT 
        id,
        warehouse_entry_id,
        processing_date,
        ROW_NUMBER() OVER (PARTITION BY warehouse_entry_id ORDER BY processing_date DESC, created_at DESC) as rn
    FROM processing_records
)
DELETE FROM processing_records 
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- Step 3: Add unique constraint to prevent future duplicates
ALTER TABLE processing_records 
ADD CONSTRAINT IF NOT EXISTS processing_records_warehouse_entry_unique 
UNIQUE (warehouse_entry_id);

-- Step 4: Create index for better performance on the unique constraint
CREATE INDEX IF NOT EXISTS idx_processing_records_warehouse_entry_unique 
ON processing_records(warehouse_entry_id);

-- Step 5: Verify the constraint was added
SELECT 
    'Unique constraint verification:' as status,
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'processing_records'::regclass 
AND conname = 'processing_records_warehouse_entry_unique';

-- Step 6: Test the constraint by showing the current state
SELECT 
    'Current processing records state:' as status,
    COUNT(*) as total_records,
    COUNT(DISTINCT warehouse_entry_id) as unique_warehouse_entries,
    COUNT(*) - COUNT(DISTINCT warehouse_entry_id) as potential_duplicates
FROM processing_records;

-- Step 7: Show which warehouse entries are already processed
SELECT 
    'Warehouse entries already processed:' as status,
    we.id as warehouse_entry_id,
    we.entry_code,
    we.total_weight,
    we.total_pieces,
    we.fish_type,
    pr.processing_date,
    pr.processing_code
FROM warehouse_entries we
INNER JOIN processing_records pr ON we.id = pr.warehouse_entry_id
ORDER BY pr.processing_date DESC
LIMIT 10;
