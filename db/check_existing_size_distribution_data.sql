-- Check existing size distribution data
-- This script helps understand what data we have before migration

-- 1. Check processing records with size distribution
SELECT 
    'Processing Records' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN size_distribution IS NOT NULL AND size_distribution != '{}'::jsonb THEN 1 END) as with_size_distribution,
    COUNT(CASE WHEN size_distribution IS NULL OR size_distribution = '{}'::jsonb THEN 1 END) as without_size_distribution
FROM processing_records;

-- 2. Check sorting batches with size distribution
SELECT 
    'Sorting Batches' as table_name,
    COUNT(*) as total_batches,
    COUNT(CASE WHEN size_distribution IS NOT NULL AND size_distribution != '{}'::jsonb THEN 1 END) as with_size_distribution,
    COUNT(CASE WHEN size_distribution IS NULL OR size_distribution = '{}'::jsonb THEN 1 END) as without_size_distribution
FROM sorting_batches;

-- 3. Find batches that need migration (have processing record with size distribution but batch doesn't)
SELECT 
    'Batches Needing Migration' as report_type,
    COUNT(*) as count
FROM sorting_batches sb
JOIN processing_records pr ON sb.processing_record_id = pr.id
WHERE pr.size_distribution IS NOT NULL 
AND pr.size_distribution != '{}'::jsonb
AND (sb.size_distribution IS NULL 
     OR sb.size_distribution = '{}'::jsonb);

-- 4. Show sample of processing records with size distribution
SELECT 
    'Sample Processing Records with Size Distribution' as report_type,
    id,
    processing_date,
    post_processing_weight,
    ready_for_dispatch_count,
    size_distribution
FROM processing_records 
WHERE size_distribution IS NOT NULL 
AND size_distribution != '{}'::jsonb
ORDER BY created_at DESC
LIMIT 5;

-- 5. Show sample of sorting batches without size distribution
SELECT 
    'Sample Sorting Batches without Size Distribution' as report_type,
    sb.id,
    sb.batch_number,
    sb.status,
    sb.created_at,
    pr.size_distribution as processing_record_size_distribution
FROM sorting_batches sb
JOIN processing_records pr ON sb.processing_record_id = pr.id
WHERE pr.size_distribution IS NOT NULL 
AND pr.size_distribution != '{}'::jsonb
AND (sb.size_distribution IS NULL 
     OR sb.size_distribution = '{}'::jsonb)
ORDER BY sb.created_at DESC
LIMIT 5;
