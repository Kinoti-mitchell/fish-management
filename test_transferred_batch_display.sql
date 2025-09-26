-- Test Transferred Batch Display
-- This script shows how transferred batches should appear in the inventory

-- 1. Check if there are any sorting_results with transfer information
SELECT 
    sr.id,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sl.name as current_storage,
    sr.transfer_source_storage_name,
    sr.transfer_id,
    CASE 
        WHEN sr.transfer_id IS NOT NULL AND sr.transfer_source_storage_name IS NOT NULL 
        THEN true 
        ELSE false 
    END as is_transferred
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sr.transfer_id IS NOT NULL
ORDER BY sr.created_at DESC;

-- 2. Check what the inventory service would show for transferred batches
SELECT 
    sl.name as storage_location_name,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as total_weight_kg,
    sb.batch_number,
    f.name as farmer_name,
    -- This is how the farmer_name field should display for transferred batches
    CASE 
        WHEN sr.transfer_id IS NOT NULL AND sr.transfer_source_storage_name IS NOT NULL 
        THEN f.name || ' (Transferred from ' || sr.transfer_source_storage_name || ')'
        ELSE f.name
    END as display_farmer_name,
    sr.transfer_source_storage_name,
    sr.transfer_id
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
LEFT JOIN processing_records pr ON sb.processing_record_id = pr.id
LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
LEFT JOIN farmers f ON we.farmer_id = f.id
WHERE sr.transfer_id IS NOT NULL
ORDER BY sl.name, sr.size_class;

-- 3. Check what happens when we approve a transfer (simulate the process)
-- This shows what the approve_transfer function should do
SELECT 'SIMULATION: What should happen when you approve a transfer:' as instruction;

-- Show current state
SELECT 'BEFORE APPROVAL:' as step;
SELECT 
    sl.name as storage_name,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.name IN ('Processing Area 2', 'Cold Storage A')
ORDER BY sl.name, sr.size_class;

-- 4. Show what the inventory should look like after approval
SELECT 'AFTER APPROVAL (what you should see):' as step;
SELECT 
    'Cold Storage A' as storage_name,
    'Size 6' as size_class,
    'X pieces' as total_pieces,
    'Y kg' as weight_kg,
    'Farmer Name (Transferred from Processing Area 2)' as display_farmer_name;
