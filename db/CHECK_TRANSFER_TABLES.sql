-- Check Transfer Tables and Functions
-- This script helps diagnose transfer system issues

-- 1. Check if transfers table exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transfers') 
        THEN 'transfers table EXISTS' 
        ELSE 'transfers table DOES NOT EXIST' 
    END as transfers_table_status;

-- 2. Check if transfer_log table exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transfer_log') 
        THEN 'transfer_log table EXISTS' 
        ELSE 'transfer_log table DOES NOT EXIST' 
    END as transfer_log_table_status;

-- 3. Check if create_batch_transfer function exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'create_batch_transfer') 
        THEN 'create_batch_transfer function EXISTS' 
        ELSE 'create_batch_transfer function DOES NOT EXIST' 
    END as create_batch_transfer_function_status;

-- 4. If transfers table exists, show its structure
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transfers') THEN
        RAISE NOTICE 'transfers table structure:';
        FOR rec IN 
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'transfers' 
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE '  %: % (nullable: %)', rec.column_name, rec.data_type, rec.is_nullable;
        END LOOP;
    END IF;
END $$;

-- 5. If transfers table exists, count records
DO $$
DECLARE
    transfer_count INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transfers') THEN
        SELECT COUNT(*) INTO transfer_count FROM transfers;
        RAISE NOTICE 'transfers table has % records', transfer_count;
        
        -- Show sample records
        IF transfer_count > 0 THEN
            RAISE NOTICE 'Sample transfer records:';
            FOR rec IN 
                SELECT id, from_storage_name, to_storage_name, size_class, status, created_at 
                FROM transfers 
                ORDER BY created_at DESC 
                LIMIT 3
            LOOP
                RAISE NOTICE '  ID: %, From: %, To: %, Size: %, Status: %, Created: %', 
                    rec.id, rec.from_storage_name, rec.to_storage_name, rec.size_class, rec.status, rec.created_at;
            END LOOP;
        END IF;
    END IF;
END $$;

-- 6. Check for any transfer-related tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE '%transfer%' 
ORDER BY table_name;
