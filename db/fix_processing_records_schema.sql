-- Fix processing_records table schema
-- This corrects the syntax error and ensures proper table structure

-- Drop the table if it exists (use with caution - this will delete all data)
-- DROP TABLE IF EXISTS processing_records;

-- Create the processing_records table with correct syntax
CREATE TABLE IF NOT EXISTS processing_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    warehouse_entry_id UUID REFERENCES warehouse_entries(id),
    processing_date DATE NOT NULL,
    processed_by UUID REFERENCES users(id),
    pre_processing_weight DECIMAL(10,2) NOT NULL,
    post_processing_weight DECIMAL(10,2) NOT NULL,
    processing_waste DECIMAL(10,2) NOT NULL,
    processing_yield DECIMAL(5,2) NOT NULL,
    size_distribution JSONB NOT NULL DEFAULT '{}',
    grading_results JSONB NOT NULL DEFAULT '{}',
    final_value DECIMAL(12,2) NOT NULL,
    ready_for_dispatch_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_processing_records_warehouse_entry_id ON processing_records(warehouse_entry_id);
CREATE INDEX IF NOT EXISTS idx_processing_records_processing_date ON processing_records(processing_date);
CREATE INDEX IF NOT EXISTS idx_processing_records_processed_by ON processing_records(processed_by);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_processing_records_updated_at ON processing_records;
CREATE TRIGGER update_processing_records_updated_at 
    BEFORE UPDATE ON processing_records 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verify table creation
SELECT 'processing_records table created successfully!' as status;
