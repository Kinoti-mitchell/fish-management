-- Add Fish Type Tracking to Warehouse Entries
-- This improves accuracy for mixed fish type batches

-- Step 1: Add fish_type column to warehouse_entries table
ALTER TABLE warehouse_entries 
ADD COLUMN IF NOT EXISTS fish_type VARCHAR(100);

-- Step 2: Add fish_type column to processing_records table
ALTER TABLE processing_records 
ADD COLUMN IF NOT EXISTS fish_type VARCHAR(100);

-- Step 3: Create fish type lookup table with average weights
CREATE TABLE IF NOT EXISTS fish_type_averages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fish_type VARCHAR(100) NOT NULL UNIQUE,
    average_weight_kg DECIMAL(4,3) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Insert fish type data based on Lake Victoria species
INSERT INTO fish_type_averages (fish_type, average_weight_kg, description) VALUES
('Nile Tilapia', 0.35, 'Most common fish, small to medium size'),
('Nile Perch', 1.20, 'Large predatory fish'),
('African Catfish', 0.65, 'Medium to large bottom feeder'),
('Silver Cyprinid', 0.15, 'Small schooling fish'),
('African Lungfish', 0.80, 'Medium air-breathing fish'),
('Blue-spotted Tilapia', 0.30, 'Small tilapia species'),
('Marbled Lungfish', 0.75, 'Medium lungfish species'),
('Electric Catfish', 0.55, 'Medium electric fish'),
('Mixed Batch', 0.50, 'Multiple fish types in one batch'),
('Unknown', 0.45, 'Fish type not specified')
ON CONFLICT (fish_type) DO NOTHING;

-- Step 5: Update existing warehouse entries with fish type if possible
-- This is a best-effort update based on existing data patterns
UPDATE warehouse_entries 
SET fish_type = 'Mixed Batch'
WHERE fish_type IS NULL;

-- Step 6: Update existing processing records with fish type from warehouse entries
UPDATE processing_records 
SET fish_type = we.fish_type
FROM warehouse_entries we
WHERE processing_records.warehouse_entry_id = we.id
AND processing_records.fish_type IS NULL
AND we.fish_type IS NOT NULL;

-- Step 7: Set default fish type for processing records without warehouse entry
UPDATE processing_records 
SET fish_type = 'Mixed Batch'
WHERE fish_type IS NULL;

-- Step 8: Create function for smart fish count estimation based on fish type
CREATE OR REPLACE FUNCTION estimate_fish_count_from_weight(
    p_weight DECIMAL(10,2),
    p_fish_type VARCHAR(100) DEFAULT 'Mixed Batch'
) RETURNS INTEGER AS $$
DECLARE
    avg_weight DECIMAL(4,3);
    estimated_count INTEGER;
BEGIN
    -- Get average weight for the fish type
    SELECT average_weight_kg INTO avg_weight
    FROM fish_type_averages
    WHERE fish_type = p_fish_type;
    
    -- If fish type not found, use mixed batch average
    IF avg_weight IS NULL THEN
        SELECT average_weight_kg INTO avg_weight
        FROM fish_type_averages
        WHERE fish_type = 'Mixed Batch';
    END IF;
    
    -- Calculate estimated count
    estimated_count := GREATEST(1, ROUND(p_weight / avg_weight));
    
    RETURN estimated_count;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create function to update processing records with smart fish count estimation
CREATE OR REPLACE FUNCTION update_processing_records_fish_count()
RETURNS TABLE(
    updated_count INTEGER,
    method_used TEXT
) AS $$
DECLARE
    warehouse_count INTEGER := 0;
    estimation_count INTEGER := 0;
BEGIN
    -- Update from warehouse pieces where available
    UPDATE processing_records 
    SET 
        ready_for_dispatch_count = we.total_pieces,
        updated_at = NOW()
    FROM warehouse_entries we
    WHERE processing_records.warehouse_entry_id = we.id
    AND (processing_records.ready_for_dispatch_count IS NULL OR processing_records.ready_for_dispatch_count = 0)
    AND we.total_pieces IS NOT NULL
    AND we.total_pieces > 0;
    
    GET DIAGNOSTICS warehouse_count = ROW_COUNT;
    
    -- Update using smart estimation for remaining records
    UPDATE processing_records 
    SET 
        ready_for_dispatch_count = estimate_fish_count_from_weight(post_processing_weight, fish_type),
        updated_at = NOW()
    WHERE ready_for_dispatch_count IS NULL OR ready_for_dispatch_count = 0;
    
    GET DIAGNOSTICS estimation_count = ROW_COUNT;
    
    -- Return results
    RETURN QUERY SELECT 
        warehouse_count + estimation_count as updated_count,
        'Warehouse pieces: ' || warehouse_count || ', Smart estimation: ' || estimation_count as method_used;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Run the update function
SELECT * FROM update_processing_records_fish_count();

-- Step 11: Show results and analysis
SELECT 
    'Fish type tracking implementation results:' as status,
    COUNT(*) as total_warehouse_entries,
    COUNT(fish_type) as entries_with_fish_type,
    COUNT(*) - COUNT(fish_type) as entries_without_fish_type
FROM warehouse_entries;

SELECT 
    'Processing records analysis:' as analysis,
    COUNT(*) as total_processing_records,
    COUNT(fish_type) as records_with_fish_type,
    COUNT(ready_for_dispatch_count) as records_with_fish_count,
    AVG(ready_for_dispatch_count) as avg_fish_count
FROM processing_records;

-- Step 12: Show fish type distribution
SELECT 
    'Fish type distribution in warehouse entries:' as distribution,
    fish_type,
    COUNT(*) as count,
    AVG(total_weight) as avg_weight,
    AVG(total_pieces) as avg_pieces
FROM warehouse_entries
WHERE fish_type IS NOT NULL
GROUP BY fish_type
ORDER BY count DESC;

-- Step 13: Show processing records by fish type
SELECT 
    'Processing records by fish type:' as processing_analysis,
    fish_type,
    COUNT(*) as count,
    AVG(post_processing_weight) as avg_weight,
    AVG(ready_for_dispatch_count) as avg_fish_count,
    AVG(post_processing_weight / ready_for_dispatch_count) as avg_weight_per_fish
FROM processing_records
WHERE fish_type IS NOT NULL AND ready_for_dispatch_count > 0
GROUP BY fish_type
ORDER BY count DESC;

-- Step 14: Show accuracy analysis
SELECT 
    'Accuracy analysis - Weight per fish by type:' as accuracy,
    pr.fish_type,
    COUNT(*) as records,
    ROUND(AVG(pr.post_processing_weight / pr.ready_for_dispatch_count), 3) as actual_avg_weight_per_fish,
    fta.average_weight_kg as expected_avg_weight,
    ROUND(
        (AVG(pr.post_processing_weight / pr.ready_for_dispatch_count) - fta.average_weight_kg) / fta.average_weight_kg * 100, 
        1
    ) as accuracy_percentage
FROM processing_records pr
JOIN fish_type_averages fta ON pr.fish_type = fta.fish_type
WHERE pr.ready_for_dispatch_count > 0
GROUP BY pr.fish_type, fta.average_weight_kg
ORDER BY accuracy_percentage;

SELECT 'Fish type tracking implementation completed successfully!' as status;
