-- Quick check to see if you have any inventory that could be disposed
-- Run this first to see what's in your system

-- Check total inventory
SELECT 'TOTAL INVENTORY' as check_type, 
       COUNT(*) as sorting_results,
       SUM(total_pieces) as total_pieces,
       ROUND(SUM(total_weight_grams) / 1000.0, 2) as total_weight_kg
FROM sorting_results 
WHERE total_pieces > 0;

-- Check inventory by storage location
SELECT 'INVENTORY BY STORAGE' as check_type,
       COALESCE(sl.name, 'No Storage Assigned') as storage_name,
       COUNT(*) as results,
       SUM(sr.total_pieces) as pieces,
       ROUND(SUM(sr.total_weight_grams) / 1000.0, 2) as weight_kg
FROM sorting_results sr
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sr.total_pieces > 0
GROUP BY sl.name
ORDER BY pieces DESC;

-- Check inventory age
SELECT 'INVENTORY AGE' as check_type,
       EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date)))::INTEGER as days_old,
       COUNT(*) as results,
       SUM(sr.total_pieces) as pieces
FROM sorting_results sr
JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
JOIN processing_records pr ON sb.processing_record_id = pr.id
WHERE sr.total_pieces > 0
AND sb.status = 'completed'
GROUP BY EXTRACT(DAYS FROM (NOW() - COALESCE(pr.processing_date, sb.created_at::date)))::INTEGER
ORDER BY days_old DESC
LIMIT 10;
