-- Fix the 17 items with NULL size_class
-- These items have valid weights but missing size_class

-- First, let's see what we're fixing
SELECT 
    'ITEMS WITH NULL SIZE_CLASS' as status,
    COUNT(*) as count,
    SUM(total_weight_grams) / 1000.0 as total_weight_kg
FROM sorting_results 
WHERE size_class IS NULL;

-- Show details of items to be fixed
SELECT 
    'ITEMS TO BE FIXED' as status,
    id,
    sorting_batch_id,
    size_class,
    total_pieces,
    total_weight_grams,
    storage_location_id,
    created_at
FROM sorting_results 
WHERE size_class IS NULL
ORDER BY total_weight_grams DESC;

-- Fix the NULL size_class items
-- Set them to size_class = 1 (Small fish category)
UPDATE sorting_results 
SET 
    size_class = 1,
    updated_at = NOW()
WHERE size_class IS NULL;

-- Verify the fix
SELECT 
    'AFTER FIX - VERIFICATION' as status,
    COUNT(*) as items_with_null_size_class
FROM sorting_results 
WHERE size_class IS NULL;

-- Show updated items
SELECT 
    'UPDATED ITEMS' as status,
    COUNT(*) as count,
    SUM(total_weight_grams) / 1000.0 as total_weight_kg
FROM sorting_results 
WHERE size_class = 1;

SELECT 'NULL size_class items fixed successfully!' as final_status;
