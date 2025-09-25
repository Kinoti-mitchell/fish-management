-- Diagnostic script to check disposal system issues
-- Run this to see what's wrong with your disposal functionality

-- 1. Check if disposal tables exist
SELECT 'Checking disposal tables...' as step;

SELECT 
    table_name,
    CASE WHEN table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('disposal_reasons', 'disposal_records', 'disposal_items', 'disposal_audit_log');

-- 2. Check if disposal functions exist
SELECT 'Checking disposal functions...' as step;

SELECT 
    routine_name,
    CASE WHEN routine_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_inventory_for_disposal', 'create_auto_disposal', 'approve_disposal', 'complete_disposal', 'generate_disposal_number');

-- 3. Check disposal table permissions
SELECT 'Checking disposal table permissions...' as step;

SELECT 
    table_name,
    privilege_type,
    grantee
FROM information_schema.table_privileges 
WHERE table_schema = 'public' 
AND table_name IN ('disposal_reasons', 'disposal_records', 'disposal_items', 'disposal_audit_log')
AND grantee IN ('authenticated', 'anon')
ORDER BY table_name, grantee;

-- 4. Check if there's any data in disposal tables
SELECT 'Checking disposal data...' as step;

SELECT 'disposal_reasons' as table_name, COUNT(*) as record_count FROM disposal_reasons
UNION ALL
SELECT 'disposal_records' as table_name, COUNT(*) as record_count FROM disposal_records
UNION ALL
SELECT 'disposal_items' as table_name, COUNT(*) as record_count FROM disposal_items
UNION ALL
SELECT 'disposal_audit_log' as table_name, COUNT(*) as record_count FROM disposal_audit_log;

-- 5. Check if sorting_results table has data (needed for disposal)
SELECT 'Checking sorting_results data...' as step;

SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN total_pieces > 0 THEN 1 END) as records_with_pieces,
    COUNT(CASE WHEN storage_location_id IS NOT NULL THEN 1 END) as records_with_storage,
    COUNT(CASE WHEN total_pieces > 0 AND storage_location_id IS NOT NULL THEN 1 END) as records_ready_for_disposal
FROM sorting_results;

-- 6. Check storage locations status
SELECT 'Checking storage locations...' as step;

SELECT 
    name,
    status,
    location_type,
    capacity_kg,
    current_usage_kg,
    CASE 
        WHEN status != 'active' THEN 'INACTIVE - Should trigger disposal'
        WHEN current_usage_kg > capacity_kg THEN 'OVERCAPACITY - Should trigger disposal'
        ELSE 'OK'
    END as disposal_trigger
FROM storage_locations
ORDER BY name;

-- 7. Test the get_inventory_for_disposal function (if it exists)
SELECT 'Testing get_inventory_for_disposal function...' as step;

-- This will show if the function works or give an error
SELECT * FROM get_inventory_for_disposal(30, true) LIMIT 5;

-- 8. Check for any recent errors in disposal_audit_log
SELECT 'Checking disposal audit log...' as step;

SELECT 
    action,
    notes,
    performed_at
FROM disposal_audit_log
ORDER BY performed_at DESC
LIMIT 10;