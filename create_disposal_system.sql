-- Create Basic Disposal System
-- This creates a simple disposal tracking system

-- 1. Create disposal_records table
CREATE TABLE IF NOT EXISTS disposal_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sorting_batch_id UUID REFERENCES sorting_batches(id) ON DELETE CASCADE,
    size_class INTEGER NOT NULL,
    disposal_reason TEXT NOT NULL,
    disposal_date DATE DEFAULT CURRENT_DATE,
    weight_disposed_kg DECIMAL(10,2) NOT NULL,
    pieces_disposed INTEGER NOT NULL,
    disposal_method TEXT DEFAULT 'discarded',
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create disposal function
CREATE OR REPLACE FUNCTION dispose_inventory(
    p_batch_id UUID,
    p_size_class INTEGER,
    p_reason TEXT,
    p_weight_kg DECIMAL(10,2),
    p_pieces INTEGER,
    p_method TEXT DEFAULT 'discarded',
    p_notes TEXT DEFAULT NULL
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_inventory_item RECORD;
    v_disposal_id UUID;
BEGIN
    -- Find the inventory item to dispose
    SELECT * INTO v_inventory_item
    FROM sorting_results
    WHERE sorting_batch_id = p_batch_id
    AND size_class = p_size_class
    AND total_weight_grams > 0;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Inventory item not found or already disposed'::TEXT;
        RETURN;
    END IF;
    
    -- Check if we have enough inventory to dispose
    IF v_inventory_item.total_weight_grams / 1000.0 < p_weight_kg THEN
        RETURN QUERY SELECT FALSE, 
            'Insufficient inventory. Available: ' || (v_inventory_item.total_weight_grams / 1000.0)::TEXT || 
            'kg, Requested: ' || p_weight_kg::TEXT || 'kg'::TEXT;
        RETURN;
    END IF;
    
    -- Create disposal record
    INSERT INTO disposal_records (
        sorting_batch_id,
        size_class,
        disposal_reason,
        weight_disposed_kg,
        pieces_disposed,
        disposal_method,
        notes
    ) VALUES (
        p_batch_id,
        p_size_class,
        p_reason,
        p_weight_kg,
        p_pieces,
        p_method,
        p_notes
    ) RETURNING id INTO v_disposal_id;
    
    -- Reduce inventory
    UPDATE sorting_results
    SET 
        total_weight_grams = total_weight_grams - (p_weight_kg * 1000),
        total_pieces = total_pieces - p_pieces,
        updated_at = NOW()
    WHERE id = v_inventory_item.id;
    
    -- Update storage capacity
    PERFORM update_storage_capacity_from_inventory();
    
    RETURN QUERY SELECT TRUE, 'Inventory disposed successfully. Disposal ID: ' || v_disposal_id::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 3. Create function to get disposal history
CREATE OR REPLACE FUNCTION get_disposal_history(
    p_days INTEGER DEFAULT 30
) RETURNS TABLE(
    disposal_id UUID,
    batch_number TEXT,
    size_class INTEGER,
    disposal_reason TEXT,
    disposal_date DATE,
    weight_disposed_kg DECIMAL(10,2),
    pieces_disposed INTEGER,
    disposal_method TEXT,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dr.id as disposal_id,
        COALESCE(sb.batch_number, 'BATCH-' || SUBSTRING(dr.sorting_batch_id::text, 1, 8))::TEXT as batch_number,
        dr.size_class,
        dr.disposal_reason,
        dr.disposal_date,
        dr.weight_disposed_kg,
        dr.pieces_disposed,
        dr.disposal_method,
        dr.notes
    FROM disposal_records dr
    LEFT JOIN sorting_batches sb ON dr.sorting_batch_id = sb.id
    WHERE dr.disposal_date >= CURRENT_DATE - INTERVAL '1 day' * p_days
    ORDER BY dr.disposal_date DESC;
END;
$$ LANGUAGE plpgsql;

-- 4. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON disposal_records TO authenticated;
GRANT EXECUTE ON FUNCTION dispose_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION get_disposal_history TO authenticated;

-- 5. Enable RLS
ALTER TABLE disposal_records ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies
CREATE POLICY "Users can view disposal records" ON disposal_records
    FOR SELECT USING (true);

CREATE POLICY "Users can create disposal records" ON disposal_records
    FOR INSERT WITH CHECK (true);

-- 7. Test the disposal system
SELECT '=== TESTING DISPOSAL SYSTEM ===' as status;

-- Test disposal function (with dummy data)
SELECT 'Disposal system created successfully!' as final_status;
