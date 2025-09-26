-- Check what transfer functions currently exist

-- 1. List all transfer-related functions
SELECT 'EXISTING TRANSFER FUNCTIONS:' as check_type;
SELECT 
    routine_name, 
    routine_type, 
    data_type as return_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%transfer%'
ORDER BY routine_name;

-- 2. Check if the functions your code needs exist
SELECT 'REQUIRED FUNCTIONS CHECK:' as check_type;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'create_batch_transfer') 
        THEN 'create_batch_transfer EXISTS' 
        ELSE 'create_batch_transfer MISSING' 
    END as create_batch_transfer_status
UNION ALL
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'approve_transfer') 
        THEN 'approve_transfer EXISTS' 
        ELSE 'approve_transfer MISSING' 
    END as approve_transfer_status
UNION ALL
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'decline_transfer') 
        THEN 'decline_transfer EXISTS' 
        ELSE 'decline_transfer MISSING' 
    END as decline_transfer_status;
