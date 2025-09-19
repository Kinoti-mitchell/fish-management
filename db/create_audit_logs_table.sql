-- Create audit_logs table for tracking user activities
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- INSERT, UPDATE, DELETE, LOGIN, LOGOUT, etc.
    table_name VARCHAR(100) NOT NULL, -- Name of the table affected
    record_id UUID, -- ID of the record affected
    old_values JSONB, -- Previous values (for UPDATE/DELETE)
    new_values JSONB, -- New values (for INSERT/UPDATE)
    ip_address INET, -- IP address of the user
    user_agent TEXT, -- Browser/client information
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own audit logs
CREATE POLICY "Users can view their own audit logs" ON audit_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Only admins can view all audit logs
CREATE POLICY "Admins can view all audit logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Policy: System can insert audit logs (for authenticated users)
CREATE POLICY "Authenticated users can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Audit trail for tracking user activities and data changes';
COMMENT ON COLUMN audit_logs.action IS 'Type of action performed (INSERT, UPDATE, DELETE, LOGIN, etc.)';
COMMENT ON COLUMN audit_logs.table_name IS 'Name of the database table affected';
COMMENT ON COLUMN audit_logs.record_id IS 'ID of the specific record affected';
COMMENT ON COLUMN audit_logs.old_values IS 'Previous values before change (JSON format)';
COMMENT ON COLUMN audit_logs.new_values IS 'New values after change (JSON format)';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the user performing the action';
COMMENT ON COLUMN audit_logs.user_agent IS 'Browser/client information';
