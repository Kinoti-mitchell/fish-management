-- Add ready_for_sorting column to processing_records table
-- This column will be used to mark processing records that are ready for sorting

-- Add the column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'processing_records' 
        AND column_name = 'ready_for_sorting'
    ) THEN
        ALTER TABLE processing_records 
        ADD COLUMN ready_for_sorting BOOLEAN DEFAULT true;
        
        -- Update existing records to be ready for sorting
        UPDATE processing_records 
        SET ready_for_sorting = true 
        WHERE ready_for_sorting IS NULL;
        
        RAISE NOTICE 'Added ready_for_sorting column to processing_records table';
    ELSE
        RAISE NOTICE 'ready_for_sorting column already exists in processing_records table';
    END IF;
END $$;
