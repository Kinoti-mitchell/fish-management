-- Add transfer tracking columns to sorting_results table
-- This script adds the columns that the application expects

-- Check if columns already exist before adding them
DO $$
BEGIN
    -- Add transfer_source_storage_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sorting_results' 
        AND column_name = 'transfer_source_storage_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE sorting_results ADD COLUMN transfer_source_storage_id UUID;
        RAISE NOTICE 'Added transfer_source_storage_id column';
    ELSE
        RAISE NOTICE 'transfer_source_storage_id column already exists';
    END IF;

    -- Add transfer_source_storage_name column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sorting_results' 
        AND column_name = 'transfer_source_storage_name'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE sorting_results ADD COLUMN transfer_source_storage_name TEXT;
        RAISE NOTICE 'Added transfer_source_storage_name column';
    ELSE
        RAISE NOTICE 'transfer_source_storage_name column already exists';
    END IF;

    -- Add transfer_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sorting_results' 
        AND column_name = 'transfer_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE sorting_results ADD COLUMN transfer_id UUID;
        RAISE NOTICE 'Added transfer_id column';
    ELSE
        RAISE NOTICE 'transfer_id column already exists';
    END IF;
END $$;

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
    -- Add foreign key constraint for transfer_source_storage_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_transfer_source_storage' 
        AND table_name = 'sorting_results'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE sorting_results 
        ADD CONSTRAINT fk_transfer_source_storage 
        FOREIGN KEY (transfer_source_storage_id) REFERENCES storage_locations(id);
        RAISE NOTICE 'Added foreign key constraint for transfer_source_storage_id';
    ELSE
        RAISE NOTICE 'Foreign key constraint for transfer_source_storage_id already exists';
    END IF;

    -- Add foreign key constraint for transfer_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_transfer_id' 
        AND table_name = 'sorting_results'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE sorting_results 
        ADD CONSTRAINT fk_transfer_id 
        FOREIGN KEY (transfer_id) REFERENCES transfers(id);
        RAISE NOTICE 'Added foreign key constraint for transfer_id';
    ELSE
        RAISE NOTICE 'Foreign key constraint for transfer_id already exists';
    END IF;
END $$;

-- Verify the columns were added
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'sorting_results' 
AND table_schema = 'public'
AND column_name IN ('transfer_source_storage_id', 'transfer_source_storage_name', 'transfer_id')
ORDER BY column_name;
