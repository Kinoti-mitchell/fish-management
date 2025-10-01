-- Fix Disposal Filter Issues
-- This addresses problems with the disposal inventory filtering system

-- 1. First, let's check what disposal reasons exist
SELECT 
    'Current disposal reasons:' as info,
    COUNT(*) as count
FROM disposal_reasons;

SELECT 
    id,
    name,
    description,
    is_active,
    created_at
FROM disposal_reasons
ORDER BY name;

-- 2. Check current disposal records
SELECT 
    'Current disposal records:' as info,
    COUNT(*) as count
FROM disposal_records;

SELECT 
    id,
    disposal_number,
    disposal_date,
    status,
    total_weight_kg,
    created_at
FROM disposal_records
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check sorting results that should be eligible for disposal
SELECT 
    'Sorting results eligible for disposal:' as info,
    COUNT(*) as count
FROM sorting_results sr
JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
WHERE sb.status = 'completed'
AND sr.total_weight_grams > 0
AND sr.storage_location_id IS NOT NULL;

-- 4. Check items by age (older than 30 days)
SELECT 
    'Items older than 30 days:' as info,
    COUNT(*) as count
FROM sorting_results sr
JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
JOIN processing_records pr ON sb.processing_record_id = pr.id
WHERE sb.status = 'completed'
AND sr.total_weight_grams > 0
AND sr.storage_location_id IS NOT NULL
AND pr.processing_date <= CURRENT_DATE - INTERVAL '30 days';

-- 5. Check storage issues
SELECT 
    'Storage issues:' as info,
    COUNT(*) as count
FROM sorting_results sr
JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sb.status = 'completed'
AND sr.total_weight_grams > 0
AND (
    sr.storage_location_id IS NULL 
    OR sl.id IS NULL 
    OR sl.status != 'active'
    OR sl.current_usage_kg > sl.capacity_kg
);

-- 6. Sample of items that should be eligible for disposal
SELECT 
    sr.id,
    sr.size_class,
    sr.total_weight_grams,
    sb.batch_number,
    sb.status as batch_status,
    pr.processing_date,
    sl.name as storage_name,
    sl.status as storage_status,
    CASE 
        WHEN pr.processing_date <= CURRENT_DATE - INTERVAL '30 days' THEN 'Age'
        WHEN sr.storage_location_id IS NULL THEN 'No Storage Location'
        WHEN sl.id IS NULL THEN 'Storage Not Found'
        WHEN sl.status != 'active' THEN 'Storage Inactive'
        WHEN sl.current_usage_kg > sl.capacity_kg THEN 'Storage Over Capacity'
        ELSE 'Other'
    END as disposal_reason,
    EXTRACT(DAYS FROM (CURRENT_DATE - pr.processing_date)) as days_old
FROM sorting_results sr
JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
LEFT JOIN processing_records pr ON sb.processing_record_id = pr.id
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sb.status = 'completed'
AND sr.total_weight_grams > 0
AND (
    pr.processing_date <= CURRENT_DATE - INTERVAL '30 days'
    OR sr.storage_location_id IS NULL 
    OR sl.id IS NULL 
    OR sl.status != 'active'
    OR sl.current_usage_kg > sl.capacity_kg
)
ORDER BY pr.processing_date ASC
LIMIT 10;

-- 7. Check if there are any issues with the disposal service query structure
SELECT 
    'Checking disposal service query structure:' as info,
    COUNT(*) as total_sorting_results,
    COUNT(CASE WHEN sr.storage_location_id IS NOT NULL THEN 1 END) as with_storage,
    COUNT(CASE WHEN sr.total_weight_grams > 0 THEN 1 END) as with_weight,
    COUNT(CASE WHEN sb.status = 'completed' THEN 1 END) as completed_batches
FROM sorting_results sr
JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id;

-- Success message
SELECT 'Disposal filter diagnostic completed - check results above to identify issues!' as status;
