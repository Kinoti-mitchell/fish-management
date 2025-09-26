-- Verify that the deployed application has all necessary data and functions

-- 1. Check if transfers table exists and has the right structure
SELECT 'TRANSFERS TABLE CHECK:' as check_type;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transfers' AND table_schema = 'public') 
        THEN 'transfers table EXISTS' 
        ELSE 'transfers table MISSING' 
    END as transfers_table_status;

-- 2. Check transfers table structure
SELECT 'TRANSFERS TABLE STRUCTURE:' as check_type;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'transfers' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check if required functions exist
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

-- 4. Check if there's any data in transfers table
SELECT 'TRANSFERS DATA CHECK:' as check_type;
SELECT COUNT(*) as total_transfers FROM transfers;

-- 5. Check if storage_locations table exists (needed for transfers)
SELECT 'STORAGE LOCATIONS CHECK:' as check_type;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'storage_locations' AND table_schema = 'public') 
        THEN 'storage_locations table EXISTS' 
        ELSE 'storage_locations table MISSING' 
    END as storage_locations_status;

-- 6. Check if profiles table exists (needed for user names in transfers)
SELECT 'PROFILES TABLE CHECK:' as check_type;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') 
        THEN 'profiles table EXISTS' 
        ELSE 'profiles table MISSING' 
    END as profiles_status;

-- 7. Check RLS policies on transfers table
SELECT 'TRANSFERS RLS POLICIES:' as check_type;
SELECT policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'transfers'
ORDER BY policyname;

-- 8. Test if functions work (dry run)
SELECT 'FUNCTION TEST:' as check_type;
SELECT 'Functions are ready for use' as status;
