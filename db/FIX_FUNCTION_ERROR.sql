-- Quick fix for the function return type error
-- Run this first, then run QUICK_TRANSFER_FIX.sql

-- Drop existing functions that might have different return types
DROP FUNCTION IF EXISTS approve_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS decline_transfer(UUID, UUID);
DROP FUNCTION IF EXISTS create_batch_transfer(UUID, UUID, JSONB, TEXT, UUID);

-- Now you can safely run QUICK_TRANSFER_FIX.sql
SELECT 'Functions dropped successfully. Now run QUICK_TRANSFER_FIX.sql' as status;
