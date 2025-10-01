-- Clean fix for NULL size_class items
-- Assigns all items with NULL size_class to size 1 (Small fish)

-- Show items to be fixed
SELECT 
    'ITEMS TO BE FIXED' as status,
    COUNT(*) as count,
    SUM(total_weight_grams) / 1000.0 as total_weight_kg
FROM sorting_results 
WHERE size_class IS NULL;

-- Fix the NULL size_class items
UPDATE sorting_results 
SET 
    size_class = 1,
    updated_at = NOW()
WHERE size_class IS NULL;

-- Verify the fix
SELECT 
    'FIXED SUCCESSFULLY' as status,
    COUNT(*) as items_with_null_size_class
FROM sorting_results 
WHERE size_class IS NULL;

-- Show updated inventory
SELECT 
    'INVENTORY AFTER FIX' as status,
    COUNT(*) as total_items,
    SUM(total_weight_grams) / 1000.0 as total_weight_kg
FROM sorting_results 
WHERE total_weight_grams > 0;
