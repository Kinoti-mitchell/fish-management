-- Comprehensive migration of size distribution data
-- This script safely migrates size distribution from processing_records to sorting_batches

-- Start transaction for safety
BEGIN;

-- Create a temporary table to track what we're migrating
CREATE TEMP TABLE migration_log (
    batch_id UUID,
    processing_record_id UUID,
    batch_number VARCHAR(50),
    old_size_distribution JSONB,
    new_size_distribution JSONB,
    migration_status VARCHAR(20),
    error_message TEXT
);

-- Step 1: Identify batches that need migration
INSERT INTO migration_log (batch_id, processing_record_id, batch_number, old_size_distribution, migration_status)
SELECT 
    sb.id,
    sb.processing_record_id,
    sb.batch_number,
    pr.size_distribution,
    'PENDING'
FROM sorting_batches sb
JOIN processing_records pr ON sb.processing_record_id = pr.id
WHERE pr.size_distribution IS NOT NULL 
AND pr.size_distribution != '{}'::jsonb
AND (sb.size_distribution IS NULL 
     OR sb.size_distribution = '{}'::jsonb);

-- Step 2: Perform the migration with error handling
DO $$
DECLARE
    rec RECORD;
    update_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    FOR rec IN 
        SELECT * FROM migration_log WHERE migration_status = 'PENDING'
    LOOP
        BEGIN
            -- Update the sorting batch with size distribution
            UPDATE sorting_batches 
            SET size_distribution = rec.old_size_distribution,
                updated_at = NOW()
            WHERE id = rec.batch_id;
            
            -- Log successful update
            UPDATE migration_log 
            SET migration_status = 'SUCCESS',
                new_size_distribution = rec.old_size_distribution
            WHERE batch_id = rec.batch_id;
            
            update_count := update_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            -- Log error
            UPDATE migration_log 
            SET migration_status = 'ERROR',
                error_message = SQLERRM
            WHERE batch_id = rec.batch_id;
            
            error_count := error_count + 1;
        END;
    END LOOP;
    
    -- Report results
    RAISE NOTICE 'Migration completed: % batches updated, % errors', update_count, error_count;
END $$;

-- Step 3: Show migration results
SELECT 
    'Migration Summary' as report_type,
    migration_status,
    COUNT(*) as count
FROM migration_log 
GROUP BY migration_status
UNION ALL
SELECT 
    'Total Batches' as report_type,
    'ALL' as migration_status,
    COUNT(*) as count
FROM sorting_batches;

-- Step 4: Show sample of migrated data
SELECT 
    'Sample Migrated Data' as report_type,
    sb.batch_number,
    sb.status,
    sb.size_distribution,
    pr.post_processing_weight,
    pr.ready_for_dispatch_count,
    ml.migration_status
FROM sorting_batches sb
JOIN processing_records pr ON sb.processing_record_id = pr.id
JOIN migration_log ml ON sb.id = ml.batch_id
WHERE sb.size_distribution IS NOT NULL 
AND sb.size_distribution != '{}'::jsonb
ORDER BY sb.created_at DESC
LIMIT 10;

-- Step 5: Show any errors
SELECT 
    'Migration Errors' as report_type,
    batch_number,
    error_message
FROM migration_log 
WHERE migration_status = 'ERROR';

-- Commit the transaction
COMMIT;

-- Final verification
SELECT 
    'Final Verification' as report_type,
    'Batches with Size Distribution' as metric,
    COUNT(*) as count
FROM sorting_batches 
WHERE size_distribution IS NOT NULL 
AND size_distribution != '{}'::jsonb;
