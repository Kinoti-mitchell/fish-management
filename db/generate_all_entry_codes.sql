-- Generate Entry Codes for All Existing Records
-- This script will generate WE001, WE002, etc. for warehouse entries
-- and PR001, PR002, etc. for processing records

-- Step 1: Add entry_code column to warehouse_entries if it doesn't exist
ALTER TABLE warehouse_entries 
ADD COLUMN IF NOT EXISTS entry_code VARCHAR(20);

-- Step 2: Add processing_code and total_pieces columns to processing_records if they don't exist
ALTER TABLE processing_records 
ADD COLUMN IF NOT EXISTS processing_code VARCHAR(20);

ALTER TABLE processing_records 
ADD COLUMN IF NOT EXISTS total_pieces INTEGER DEFAULT 0;

-- Step 3: Disable RLS on all tables
ALTER TABLE farmers DISABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE processing_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE sorting_batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE sorting_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE size_class_thresholds DISABLE ROW LEVEL SECURITY;
ALTER TABLE sorted_fish_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Step 4: Grant full permissions to all roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant sequence permissions
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant function permissions
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Step 5: Drop all existing RLS policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- Step 6: Generate WE001, WE002, etc. for existing warehouse entries
UPDATE warehouse_entries 
SET entry_code = 'WE' || LPAD(
    (SELECT COUNT(*) + 1 
     FROM warehouse_entries we2 
     WHERE we2.created_at < warehouse_entries.created_at 
     OR (we2.created_at = warehouse_entries.created_at AND we2.id < warehouse_entries.id)
    )::TEXT, 3, '0')
WHERE entry_code IS NULL OR entry_code = '';

-- Step 7: Generate PR001, PR002, etc. for existing processing records
UPDATE processing_records 
SET processing_code = 'PR' || LPAD(
    (SELECT COUNT(*) + 1 
     FROM processing_records pr2 
     WHERE pr2.processing_date < processing_records.processing_date 
     OR (pr2.processing_date = processing_records.processing_date 
         AND (pr2.created_at < processing_records.created_at 
              OR (pr2.created_at = processing_records.created_at AND pr2.id < processing_records.id)))
    )::TEXT, 3, '0')
WHERE processing_code IS NULL OR processing_code = '';

-- Step 8: Add unique constraints (drop first if they exist)
DO $$ 
BEGIN
    -- Drop existing constraints if they exist
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_entries_entry_code_unique') THEN
        ALTER TABLE warehouse_entries DROP CONSTRAINT warehouse_entries_entry_code_unique;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'processing_records_processing_code_unique') THEN
        ALTER TABLE processing_records DROP CONSTRAINT processing_records_processing_code_unique;
    END IF;
    
    -- Add the constraints
    ALTER TABLE warehouse_entries ADD CONSTRAINT warehouse_entries_entry_code_unique UNIQUE (entry_code);
    ALTER TABLE processing_records ADD CONSTRAINT processing_records_processing_code_unique UNIQUE (processing_code);
END $$;

-- Step 9: Create function to generate unique warehouse entry codes
CREATE OR REPLACE FUNCTION generate_warehouse_entry_code()
RETURNS TEXT AS $$
DECLARE
    sequence_num INTEGER;
    new_entry_code TEXT;
BEGIN
    -- Find the next sequence number
    SELECT COALESCE(MAX(
        CASE 
            WHEN we.entry_code ~ '^WE[0-9]+$' 
            THEN CAST(SUBSTRING(we.entry_code FROM 'WE([0-9]+)') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1 INTO sequence_num
    FROM warehouse_entries we
    WHERE we.entry_code IS NOT NULL;
    
    -- Generate the entry code (WE001, WE002, etc.)
    new_entry_code := 'WE' || LPAD(sequence_num::TEXT, 3, '0');
    
    RETURN new_entry_code;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Create function to generate unique processing codes
CREATE OR REPLACE FUNCTION generate_processing_code()
RETURNS TEXT AS $$
DECLARE
    sequence_num INTEGER;
    new_processing_code TEXT;
BEGIN
    -- Find the next sequence number
    SELECT COALESCE(MAX(
        CASE 
            WHEN pr.processing_code ~ '^PR[0-9]+$' 
            THEN CAST(SUBSTRING(pr.processing_code FROM 'PR([0-9]+)') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1 INTO sequence_num
    FROM processing_records pr
    WHERE pr.processing_code IS NOT NULL;
    
    -- Generate the processing code (PR001, PR002, etc.)
    new_processing_code := 'PR' || LPAD(sequence_num::TEXT, 3, '0');
    
    RETURN new_processing_code;
END;
$$ LANGUAGE plpgsql;

-- Step 11: Create trigger to automatically generate warehouse entry codes
CREATE OR REPLACE FUNCTION set_warehouse_entry_code()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set entry_code if it's not already provided
    IF NEW.entry_code IS NULL OR NEW.entry_code = '' THEN
        NEW.entry_code := generate_warehouse_entry_code();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 12: Create trigger to automatically generate processing codes
CREATE OR REPLACE FUNCTION set_processing_code()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set processing_code if it's not already provided
    IF NEW.processing_code IS NULL OR NEW.processing_code = '' THEN
        NEW.processing_code := generate_processing_code();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 13: Create the triggers
DROP TRIGGER IF EXISTS trigger_set_warehouse_entry_code ON warehouse_entries;
CREATE TRIGGER trigger_set_warehouse_entry_code
    BEFORE INSERT ON warehouse_entries
    FOR EACH ROW
    EXECUTE FUNCTION set_warehouse_entry_code();

DROP TRIGGER IF EXISTS trigger_set_processing_code ON processing_records;
CREATE TRIGGER trigger_set_processing_code
    BEFORE INSERT ON processing_records
    FOR EACH ROW
    EXECUTE FUNCTION set_processing_code();

-- Step 14: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_warehouse_entries_entry_code ON warehouse_entries(entry_code);
CREATE INDEX IF NOT EXISTS idx_processing_records_processing_code ON processing_records(processing_code);

-- Step 15: Add comments to document the code formats
COMMENT ON COLUMN warehouse_entries.entry_code IS 'Unique entry code in format WE001, WE002, etc.';
COMMENT ON COLUMN processing_records.processing_code IS 'Unique processing code in format PR001, PR002, etc.';
COMMENT ON COLUMN processing_records.total_pieces IS 'Number of fish pieces processed in this batch';

-- Step 16: Verify the setup
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled,
    CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as status
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Step 17: Show generated codes
SELECT 'Warehouse Entries' as table_name, entry_code, created_at 
FROM warehouse_entries 
ORDER BY created_at 
LIMIT 10;

SELECT 'Processing Records' as table_name, processing_code, processing_date::timestamp as created_at
FROM processing_records 
ORDER BY processing_date 
LIMIT 10;
