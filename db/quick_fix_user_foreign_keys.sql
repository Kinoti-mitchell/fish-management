-- Quick Fix for User Foreign Key Constraint Error
-- This script fixes the immediate issue with missing user references

-- First, let's see what user IDs are causing the problem
SELECT DISTINCT requested_by, approved_by 
FROM transfers 
WHERE requested_by IS NOT NULL OR approved_by IS NOT NULL;

-- Add missing users to the users table
-- This will create user records for any user IDs that exist in transfers but not in users
INSERT INTO users (id, email, name) 
SELECT DISTINCT requested_by, 'user-' || requested_by || '@riofish.com', 'User ' || SUBSTRING(requested_by::text, 1, 8)
FROM transfers 
WHERE requested_by IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = transfers.requested_by)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) 
SELECT DISTINCT approved_by, 'user-' || approved_by || '@riofish.com', 'User ' || SUBSTRING(approved_by::text, 1, 8)
FROM transfers 
WHERE approved_by IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = transfers.approved_by)
ON CONFLICT (id) DO NOTHING;

-- Verify that all user references now exist
SELECT 
    'Missing requested_by users:' as issue,
    COUNT(*) as count
FROM transfers t
WHERE t.requested_by IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.requested_by)

UNION ALL

SELECT 
    'Missing approved_by users:' as issue,
    COUNT(*) as count
FROM transfers t
WHERE t.approved_by IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.approved_by);

-- If the above query returns 0 for both counts, then we can safely add the foreign key constraints
-- Otherwise, we need to investigate further
