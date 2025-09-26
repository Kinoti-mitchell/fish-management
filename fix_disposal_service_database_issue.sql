-- Fix DisposalService Database Issue
-- This script adds the missing storage_location_id column to sorting_results table
-- and ensures all related tables have the necessary columns for disposal functionality

-- 1. Add storage_location_id column to sorting_results table
DO $$
BEGIN
    -- Add storage_location_id column to sorting_results
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sorting_results' 
        AND column_name = 'storage_location_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE sorting_results 
        ADD COLUMN storage_location_id UUID REFERENCES storage_locations(id);
        RAISE NOTICE 'Added storage_location_id column to sorting_results table';
    ELSE
        RAISE NOTICE 'storage_location_id column already exists in sorting_results table';
    END IF;

    -- Add storage_location_id column to sorting_batches
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sorting_batches' 
        AND column_name = 'storage_location_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE sorting_batches 
        ADD COLUMN storage_location_id UUID REFERENCES storage_locations(id);
        RAISE NOTICE 'Added storage_location_id column to sorting_batches table';
    ELSE
        RAISE NOTICE 'storage_location_id column already exists in sorting_batches table';
    END IF;

    -- Add storage_location_id column to sorted_fish_items
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sorted_fish_items' 
        AND column_name = 'storage_location_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE sorted_fish_items 
        ADD COLUMN storage_location_id UUID REFERENCES storage_locations(id);
        RAISE NOTICE 'Added storage_location_id column to sorted_fish_items table';
    ELSE
        RAISE NOTICE 'storage_location_id column already exists in sorted_fish_items table';
    END IF;
END $$;

-- 2. Verify the columns were added successfully
SELECT '=== VERIFICATION: SORTING RESULTS TABLE STRUCTURE ===' as section;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sorting_results' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check if there are any existing records that need storage_location_id populated
SELECT '=== CHECKING EXISTING RECORDS ===' as section;

SELECT 
    COUNT(*) as total_sorting_results,
    COUNT(storage_location_id) as records_with_storage_location,
    COUNT(*) - COUNT(storage_location_id) as records_missing_storage_location
FROM sorting_results;

-- 4. If there are records missing storage_location_id, we can set a default
-- (This is optional - you may want to manually assign storage locations)
DO $$
DECLARE
    default_storage_id UUID;
    missing_count INTEGER;
BEGIN
    -- Get a default storage location (first active one)
    SELECT id INTO default_storage_id 
    FROM storage_locations 
    WHERE status = 'active' 
    ORDER BY name 
    LIMIT 1;
    
    -- Count records missing storage_location_id
    SELECT COUNT(*) INTO missing_count
    FROM sorting_results 
    WHERE storage_location_id IS NULL;
    
    -- If we have a default storage location and missing records, update them
    IF default_storage_id IS NOT NULL AND missing_count > 0 THEN
        UPDATE sorting_results 
        SET storage_location_id = default_storage_id
        WHERE storage_location_id IS NULL;
        
        RAISE NOTICE 'Updated % records with default storage location: %', 
                     missing_count, 
                     (SELECT name FROM storage_locations WHERE id = default_storage_id);
    ELSIF missing_count > 0 THEN
        RAISE NOTICE 'Found % records missing storage_location_id, but no default storage location available', missing_count;
    ELSE
        RAISE NOTICE 'All sorting_results records have storage_location_id assigned';
    END IF;
END $$;

-- 5. Final verification
SELECT '=== FINAL VERIFICATION ===' as section;

SELECT 
    sl.name as storage_name,
    COUNT(sr.id) as sorting_results_count,
    SUM(sr.total_pieces) as total_pieces,
    ROUND(SUM(sr.total_weight_grams) / 1000.0, 2) as total_weight_kg
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
GROUP BY sl.id, sl.name
ORDER BY total_weight_kg DESC;

SELECT 'DisposalService database fix completed successfully!' as status;
