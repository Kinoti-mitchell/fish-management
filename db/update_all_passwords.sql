-- Update All User Passwords to "password123"
-- This script updates all existing users to use "password123" as their password
-- The password is hashed with bcrypt (salt rounds: 10)

-- IMPORTANT: This is the bcrypt hash for "password123" with 10 salt rounds
-- Generated using: bcrypt.hash("password123", 10)
UPDATE profiles 
SET 
    password_hash = '$2b$10$rBnvMvpSCkDHqxszslkKbeW/Hqk4YYtoxPVEjvfA0Ofd8V4YeavxO',
    updated_at = NOW()
WHERE is_active = true;

-- Verify the update
SELECT 
    email, 
    first_name, 
    last_name, 
    role, 
    is_active,
    updated_at
FROM profiles 
ORDER BY updated_at DESC;
