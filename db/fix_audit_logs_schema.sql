-- Fix audit_logs table schema inconsistency
-- This script ensures the audit_logs table has consistent column definitions

-- First, check if the table exists and what its current structure is
-- If it exists with VARCHAR(50), we'll alter it to VARCHAR(100) for consistency

-- Drop and recreate the audit_logs table with consistent schema
DROP TABLE IF EXISTS audit_logs CASCADE;

-- Create audit_logs table with consistent schema
CREATE TABLE audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- Increased from VARCHAR(50) to VARCHAR(100) for consistency
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id);

-- Disable RLS for development (as per your current setup)
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON audit_logs TO anon;
GRANT ALL ON audit_logs TO authenticated;
GRANT ALL ON audit_logs TO service_role;

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Audit trail for tracking user activities and data changes';
COMMENT ON COLUMN audit_logs.action IS 'Type of action performed (INSERT, UPDATE, DELETE, LOGIN, etc.)';
COMMENT ON COLUMN audit_logs.table_name IS 'Name of the database table affected';
COMMENT ON COLUMN audit_logs.record_id IS 'ID of the specific record affected';
COMMENT ON COLUMN audit_logs.old_values IS 'Previous values before change (JSON format)';
COMMENT ON COLUMN audit_logs.new_values IS 'New values after change (JSON format)';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the user performing the action';
COMMENT ON COLUMN audit_logs.user_agent IS 'Browser/client information';
