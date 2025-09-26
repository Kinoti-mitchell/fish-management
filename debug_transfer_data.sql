-- Debug transfer data to see what's missing

-- 1. Check what's in the transfers table
SELECT 'CURRENT TRANSFER DATA:' as check_type;
SELECT 
    id,
    from_storage_location_id,
    to_storage_location_id,
    from_storage_name,
    to_storage_name,
    size_class,
    quantity,
    weight_kg,
    notes,
    status,
    created_at
FROM transfers 
ORDER BY created_at DESC 
LIMIT 5;

-- 2. Check if storage_locations table has data
SELECT 'STORAGE LOCATIONS DATA:' as check_type;
SELECT id, name, location_type, status
FROM storage_locations 
ORDER BY name;

-- 3. Check if the create_batch_transfer function is populating storage names
SELECT 'FUNCTION DEFINITION CHECK:' as check_type;
SELECT routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'create_batch_transfer';

-- 4. Test the function with sample data
SELECT 'TESTING FUNCTION:' as check_type;
-- This will show if the function can get storage names
SELECT 
    sl1.name as from_name,
    sl2.name as to_name
FROM storage_locations sl1, storage_locations sl2 
WHERE sl1.id != sl2.id 
LIMIT 1;