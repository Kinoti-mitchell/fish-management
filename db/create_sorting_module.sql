-- Sorting Module Database Schema
-- This module implements the sorting workflow between Processing and Inventory
-- Fish must be sorted into size classes 0-10 before being stored in inventory

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types for sorting
DO $$ BEGIN
    CREATE TYPE sorting_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Size Class Thresholds Table - Configurable thresholds for size classes
CREATE TABLE IF NOT EXISTS size_class_thresholds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_number INTEGER NOT NULL UNIQUE CHECK (class_number >= 0 AND class_number <= 10),
    min_weight_grams DECIMAL(10,2) NOT NULL,
    max_weight_grams DECIMAL(10,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    CONSTRAINT valid_weight_range CHECK (min_weight_grams <= max_weight_grams)
);

-- 2. Sorting Batches Table - Tracks each sorting operation
CREATE TABLE IF NOT EXISTS sorting_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processing_record_id UUID NOT NULL REFERENCES processing_records(id),
    batch_number VARCHAR(50) NOT NULL,
    total_weight_grams DECIMAL(12,2) NOT NULL,
    total_pieces INTEGER NOT NULL,
    sorting_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sorted_by UUID REFERENCES auth.users(id),
    status sorting_status DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(processing_record_id, batch_number)
);

-- 3. Sorted Fish Items Table - Individual fish items after sorting
CREATE TABLE IF NOT EXISTS sorted_fish_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sorting_batch_id UUID NOT NULL REFERENCES sorting_batches(id) ON DELETE CASCADE,
    size_class INTEGER NOT NULL CHECK (size_class >= 0 AND size_class <= 10),
    weight_grams DECIMAL(10,2) NOT NULL,
    length_cm DECIMAL(8,2),
    grade TEXT CHECK (grade IN ('A', 'B', 'C')),
    quality_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Sorting Results Summary Table - Aggregated results per batch per size class
CREATE TABLE IF NOT EXISTS sorting_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sorting_batch_id UUID NOT NULL REFERENCES sorting_batches(id) ON DELETE CASCADE,
    size_class INTEGER NOT NULL CHECK (size_class >= 0 AND size_class <= 10),
    total_pieces INTEGER NOT NULL DEFAULT 0,
    total_weight_grams DECIMAL(12,2) NOT NULL DEFAULT 0,
    average_weight_grams DECIMAL(10,2),
    grade_distribution JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(sorting_batch_id, size_class)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sorting_batches_processing_record ON sorting_batches(processing_record_id);
CREATE INDEX IF NOT EXISTS idx_sorting_batches_status ON sorting_batches(status);
CREATE INDEX IF NOT EXISTS idx_sorted_fish_items_batch ON sorted_fish_items(sorting_batch_id);
CREATE INDEX IF NOT EXISTS idx_sorted_fish_items_size_class ON sorted_fish_items(size_class);
CREATE INDEX IF NOT EXISTS idx_sorting_results_batch ON sorting_results(sorting_batch_id);
CREATE INDEX IF NOT EXISTS idx_sorting_results_size_class ON sorting_results(size_class);
CREATE INDEX IF NOT EXISTS idx_size_class_thresholds_active ON size_class_thresholds(is_active);

-- Temporarily disable the validation trigger for initial data insertion
DROP TRIGGER IF EXISTS validate_size_class_thresholds_trigger ON size_class_thresholds;

-- Insert default size class thresholds (configurable by admin)
INSERT INTO size_class_thresholds (class_number, min_weight_grams, max_weight_grams, description) VALUES
(0, 0, 99.99, 'Extra Small - Under 100g'),
(1, 100, 199.99, 'Very Small - 100-200g'),
(2, 200, 299.99, 'Small - 200-300g'),
(3, 300, 499.99, 'Small-Medium - 300-500g'),
(4, 500, 699.99, 'Medium - 500-700g'),
(5, 700, 999.99, 'Medium-Large - 700-1000g'),
(6, 1000, 1499.99, 'Large - 1000-1500g'),
(7, 1500, 1999.99, 'Very Large - 1500-2000g'),
(8, 2000, 2999.99, 'Extra Large - 2000-3000g'),
(9, 3000, 4999.99, 'Jumbo - 3000-5000g'),
(10, 5000, 999999.99, 'Giant - Over 5000g')
ON CONFLICT (class_number) DO NOTHING;

-- Function to get size class for a given weight
CREATE OR REPLACE FUNCTION get_size_class_for_weight(weight_grams DECIMAL)
RETURNS INTEGER AS $$
DECLARE
    result_class INTEGER;
BEGIN
    SELECT class_number INTO result_class
    FROM size_class_thresholds
    WHERE is_active = true
    AND weight_grams >= min_weight_grams 
    AND weight_grams <= max_weight_grams
    ORDER BY class_number
    LIMIT 1;
    
    IF result_class IS NULL THEN
        RAISE EXCEPTION 'No size class found for weight: % grams', weight_grams;
    END IF;
    
    RETURN result_class;
END;
$$ LANGUAGE plpgsql;

-- Function to create a sorting batch from processing record
CREATE OR REPLACE FUNCTION create_sorting_batch(
    p_processing_record_id UUID,
    p_batch_number VARCHAR(50),
    p_sorted_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_batch_id UUID;
    v_processing_record RECORD;
BEGIN
    -- Get processing record details
    SELECT * INTO v_processing_record 
    FROM processing_records 
    WHERE id = p_processing_record_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Processing record not found: %', p_processing_record_id;
    END IF;
    
    -- Check if processing record is already sorted
    IF EXISTS (
        SELECT 1 FROM sorting_batches 
        WHERE processing_record_id = p_processing_record_id 
        AND status = 'completed'
    ) THEN
        RAISE EXCEPTION 'Processing record already sorted: %', p_processing_record_id;
    END IF;
    
    -- Create sorting batch
    INSERT INTO sorting_batches (
        processing_record_id,
        batch_number,
        total_weight_grams,
        total_pieces,
        sorted_by,
        status
    ) VALUES (
        p_processing_record_id,
        p_batch_number,
        v_processing_record.post_processing_weight * 1000, -- Convert kg to grams
        v_processing_record.ready_for_dispatch_count,
        p_sorted_by,
        'pending'
    ) RETURNING id INTO v_batch_id;
    
    RETURN v_batch_id;
END;
$$ LANGUAGE plpgsql;

-- Function to add sorted fish items to a batch
CREATE OR REPLACE FUNCTION add_sorted_fish_item(
    p_sorting_batch_id UUID,
    p_weight_grams DECIMAL,
    p_length_cm DECIMAL DEFAULT NULL,
    p_grade TEXT DEFAULT NULL,
    p_quality_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_item_id UUID;
    v_size_class INTEGER;
BEGIN
    -- Get size class for the weight
    v_size_class := get_size_class_for_weight(p_weight_grams);
    
    -- Insert sorted fish item
    INSERT INTO sorted_fish_items (
        sorting_batch_id,
        size_class,
        weight_grams,
        length_cm,
        grade,
        quality_notes
    ) VALUES (
        p_sorting_batch_id,
        v_size_class,
        p_weight_grams,
        p_length_cm,
        p_grade,
        p_quality_notes
    ) RETURNING id INTO v_item_id;
    
    -- Update or insert sorting results summary
    INSERT INTO sorting_results (
        sorting_batch_id,
        size_class,
        total_pieces,
        total_weight_grams,
        average_weight_grams,
        grade_distribution
    ) VALUES (
        p_sorting_batch_id,
        v_size_class,
        1,
        p_weight_grams,
        p_weight_grams,
        CASE 
            WHEN p_grade IS NOT NULL THEN jsonb_build_object(p_grade, 1)
            ELSE '{}'::jsonb
        END
    )
    ON CONFLICT (sorting_batch_id, size_class)
    DO UPDATE SET
        total_pieces = sorting_results.total_pieces + 1,
        total_weight_grams = sorting_results.total_weight_grams + p_weight_grams,
        average_weight_grams = (sorting_results.total_weight_grams + p_weight_grams) / (sorting_results.total_pieces + 1),
        grade_distribution = CASE 
            WHEN p_grade IS NOT NULL THEN
                COALESCE(sorting_results.grade_distribution, '{}'::jsonb) || 
                jsonb_build_object(p_grade, COALESCE((sorting_results.grade_distribution->>p_grade)::integer, 0) + 1)
            ELSE sorting_results.grade_distribution
        END,
        updated_at = NOW();
    
    RETURN v_item_id;
END;
$$ LANGUAGE plpgsql;

-- Function to complete sorting batch
CREATE OR REPLACE FUNCTION complete_sorting_batch(p_sorting_batch_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_batch RECORD;
    v_total_items INTEGER;
    v_expected_items INTEGER;
BEGIN
    -- Get batch details
    SELECT * INTO v_batch FROM sorting_batches WHERE id = p_sorting_batch_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sorting batch not found: %', p_sorting_batch_id;
    END IF;
    
    IF v_batch.status = 'completed' THEN
        RAISE EXCEPTION 'Sorting batch already completed: %', p_sorting_batch_id;
    END IF;
    
    -- Count total sorted items
    SELECT COUNT(*) INTO v_total_items FROM sorted_fish_items WHERE sorting_batch_id = p_sorting_batch_id;
    
    -- Check if all expected items are sorted
    IF v_total_items < v_batch.total_pieces THEN
        RAISE EXCEPTION 'Not all fish items have been sorted. Expected: %, Sorted: %', 
            v_batch.total_pieces, v_total_items;
    END IF;
    
    -- Update batch status to completed
    UPDATE sorting_batches 
    SET status = 'completed', updated_at = NOW()
    WHERE id = p_sorting_batch_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get sorting results for inventory integration
CREATE OR REPLACE FUNCTION get_sorting_results_for_inventory(p_sorting_batch_id UUID)
RETURNS TABLE(
    size_class INTEGER,
    total_pieces INTEGER,
    total_weight_grams DECIMAL,
    average_weight_grams DECIMAL,
    grade_distribution JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sr.size_class,
        sr.total_pieces,
        sr.total_weight_grams,
        sr.average_weight_grams,
        sr.grade_distribution
    FROM sorting_results sr
    WHERE sr.sorting_batch_id = p_sorting_batch_id
    ORDER BY sr.size_class;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE size_class_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE sorting_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sorted_fish_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sorting_results ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (drop existing ones first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view size class thresholds" ON size_class_thresholds;
DROP POLICY IF EXISTS "Admins can manage size class thresholds" ON size_class_thresholds;
DROP POLICY IF EXISTS "Users can view sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Users can create sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Users can update their own sorting batches" ON sorting_batches;
DROP POLICY IF EXISTS "Users can view sorted fish items" ON sorted_fish_items;
DROP POLICY IF EXISTS "Users can create sorted fish items" ON sorted_fish_items;
DROP POLICY IF EXISTS "Users can view sorting results" ON sorting_results;

CREATE POLICY "Users can view size class thresholds" ON size_class_thresholds
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage size class thresholds" ON size_class_thresholds
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND (auth.users.raw_user_meta_data->>'role' = 'admin' OR auth.users.raw_user_meta_data->>'role' = 'manager')
        )
    );

CREATE POLICY "Users can view sorting batches" ON sorting_batches
    FOR SELECT USING (true);

CREATE POLICY "Users can create sorting batches" ON sorting_batches
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own sorting batches" ON sorting_batches
    FOR UPDATE USING (sorted_by = auth.uid() OR EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.users.id = auth.uid() 
        AND (auth.users.raw_user_meta_data->>'role' = 'admin' OR auth.users.raw_user_meta_data->>'role' = 'manager')
    ));

CREATE POLICY "Users can view sorted fish items" ON sorted_fish_items
    FOR SELECT USING (true);

CREATE POLICY "Users can create sorted fish items" ON sorted_fish_items
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view sorting results" ON sorting_results
    FOR SELECT USING (true);

-- Function to validate no overlapping size class thresholds
CREATE OR REPLACE FUNCTION validate_size_class_thresholds()
RETURNS TRIGGER AS $$
DECLARE
    v_overlap_count INTEGER;
BEGIN
    -- Only validate if the record is being activated or updated
    -- Skip validation for initial data insertion or deactivation
    IF NEW.is_active = false THEN
        RETURN NEW;
    END IF;
    
    -- Check for overlapping thresholds with other active records
    SELECT COUNT(*) INTO v_overlap_count
    FROM size_class_thresholds sct2 
    WHERE sct2.id != COALESCE(NEW.id, OLD.id)
    AND sct2.is_active = true 
    AND (
        (NEW.min_weight_grams <= sct2.max_weight_grams 
         AND NEW.max_weight_grams >= sct2.min_weight_grams)
    );
    
    IF v_overlap_count > 0 THEN
        RAISE EXCEPTION 'Size class thresholds cannot overlap. Found % overlapping threshold(s).', v_overlap_count;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate size class thresholds (after initial data insertion)
CREATE TRIGGER validate_size_class_thresholds_trigger
    BEFORE INSERT OR UPDATE ON size_class_thresholds
    FOR EACH ROW
    EXECUTE FUNCTION validate_size_class_thresholds();

-- Create trigger to update sorting_results when sorted_fish_items change
CREATE OR REPLACE FUNCTION update_sorting_results_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- This will be handled by the add_sorted_fish_item function
    -- But we can add additional validation here if needed
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE size_class_thresholds IS 'Configurable thresholds for fish size classes 0-10';
COMMENT ON TABLE sorting_batches IS 'Tracks each sorting operation from processing records';
COMMENT ON TABLE sorted_fish_items IS 'Individual fish items after sorting with size class assignment';
COMMENT ON TABLE sorting_results IS 'Aggregated sorting results per batch per size class for inventory integration';

COMMENT ON FUNCTION get_size_class_for_weight(DECIMAL) IS 'Returns the size class (0-10) for a given weight in grams';
COMMENT ON FUNCTION create_sorting_batch(UUID, VARCHAR, UUID) IS 'Creates a new sorting batch from a processing record';
COMMENT ON FUNCTION add_sorted_fish_item(UUID, DECIMAL, DECIMAL, TEXT, TEXT) IS 'Adds a sorted fish item to a batch and updates summary';
COMMENT ON FUNCTION complete_sorting_batch(UUID) IS 'Marks a sorting batch as completed after all items are sorted';
COMMENT ON FUNCTION get_sorting_results_for_inventory(UUID) IS 'Returns sorting results formatted for inventory integration';
