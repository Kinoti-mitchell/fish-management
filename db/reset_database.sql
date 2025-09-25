-- Reset database to clean state
-- WARNING: This will delete ALL existing data!

-- Drop all existing tables and their dependencies
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Now you can run the migration fresh
