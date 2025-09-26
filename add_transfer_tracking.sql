-- Add Transfer Tracking to Sorting Results
-- This script adds columns to track transfer history in the sorting_results table

-- 1. Check current sorting_results table structure
SELECT 'Current Sorting Results Structure' as check_type;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sorting_results' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Add transfer tracking columns to sorting_results table
ALTER TABLE sorting_results 
ADD COLUMN IF NOT EXISTS transfer_source_storage_id UUID,
ADD COLUMN IF NOT EXISTS transfer_source_storage_name TEXT,
ADD COLUMN IF NOT EXISTS transfer_id UUID,
ADD COLUMN IF NOT EXISTS transfer_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_transferred BOOLEAN DEFAULT FALSE;

-- 3. Add foreign key constraint for transfer_id
ALTER TABLE sorting_results 
ADD CONSTRAINT fk_sorting_results_transfer_id 
FOREIGN KEY (transfer_id) REFERENCES transfers(id);

-- 4. Update the moved inventory record to show it was transferred
UPDATE sorting_results
SET 
    transfer_source_storage_id = (SELECT id FROM storage_locations WHERE name = 'Processing Area 2'),
    transfer_source_storage_name = 'Processing Area 2',
    transfer_id = (SELECT id FROM transfers 
                   WHERE from_storage_name = 'Processing Area 2' 
                   AND to_storage_name = 'Cold Storage B' 
                   AND size_class = 1 
                   ORDER BY created_at DESC LIMIT 1),
    transfer_date = NOW(),
    is_transferred = TRUE,
    updated_at = NOW()
WHERE storage_location_id = (SELECT id FROM storage_locations WHERE name = 'Cold Storage B')
AND size_class = 1;

-- 5. Check the updated record
SELECT 'Updated Sorting Results Record with Transfer Info' as check_type;
SELECT 
    sr.id,
    sl.name as current_storage,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sr.transfer_source_storage_name,
    sr.transfer_id,
    sr.transfer_date,
    sr.is_transferred,
    sb.batch_number,
    f.name as farmer_name
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
LEFT JOIN processing_records pr ON sb.processing_record_id = pr.id
LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
LEFT JOIN farmers f ON we.farmer_id = f.id
WHERE sl.name = 'Cold Storage B' AND sr.size_class = 1;

-- 6. Create a view to show transfer history
CREATE OR REPLACE VIEW inventory_with_transfer_history AS
SELECT 
    sr.id,
    sl.name as current_storage,
    sl.location_type,
    sr.size_class,
    sr.total_pieces,
    ROUND(sr.total_weight_grams / 1000.0, 2) as weight_kg,
    sb.batch_number,
    f.name as farmer_name,
    sr.is_transferred,
    sr.transfer_source_storage_name,
    sr.transfer_date,
    t.status as transfer_status,
    sr.created_at as original_date,
    sr.updated_at
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
LEFT JOIN processing_records pr ON sb.processing_record_id = pr.id
LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
LEFT JOIN farmers f ON we.farmer_id = f.id
LEFT JOIN transfers t ON sr.transfer_id = t.id
ORDER BY sr.updated_at DESC;

-- 7. Grant access to the view
GRANT SELECT ON inventory_with_transfer_history TO authenticated;

-- 8. Test the view
SELECT 'Inventory with Transfer History' as check_type;
SELECT 
    current_storage,
    size_class,
    weight_kg,
    batch_number,
    farmer_name,
    is_transferred,
    transfer_source_storage_name,
    transfer_date,
    transfer_status
FROM inventory_with_transfer_history
WHERE current_storage = 'Cold Storage B' AND size_class = 1;

-- 9. Check the updated table structure
SELECT 'Updated Sorting Results Structure' as check_type;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sorting_results' 
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'Transfer tracking added successfully!' as status;
