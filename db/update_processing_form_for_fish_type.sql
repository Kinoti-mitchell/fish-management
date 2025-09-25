-- Update Processing Form to Include Fish Type Selection
-- This ensures processing records inherit and can modify fish type information

-- Step 1: Check current processing records structure
SELECT 
    'Current processing records analysis:' as analysis,
    COUNT(*) as total_records,
    COUNT(fish_type) as records_with_fish_type,
    COUNT(ready_for_dispatch_count) as records_with_fish_count
FROM processing_records;

-- Step 2: Create function to inherit fish type from warehouse entry
CREATE OR REPLACE FUNCTION inherit_fish_type_from_warehouse(
    p_warehouse_entry_id UUID
) RETURNS VARCHAR(100) AS $$
DECLARE
    inherited_fish_type VARCHAR(100);
BEGIN
    SELECT fish_type INTO inherited_fish_type
    FROM warehouse_entries
    WHERE id = p_warehouse_entry_id;
    
    RETURN COALESCE(inherited_fish_type, 'Mixed Batch');
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create function to validate processing fish type
CREATE OR REPLACE FUNCTION validate_processing_fish_type(
    p_fish_type VARCHAR(100),
    p_warehouse_entry_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    warehouse_fish_type VARCHAR(100);
BEGIN
    -- Get fish type from warehouse entry
    SELECT fish_type INTO warehouse_fish_type
    FROM warehouse_entries
    WHERE id = p_warehouse_entry_id;
    
    -- If warehouse entry has specific fish type, processing should match or be more specific
    IF warehouse_fish_type IS NOT NULL AND warehouse_fish_type != 'Mixed Batch' THEN
        RETURN p_fish_type = warehouse_fish_type OR p_fish_type = 'Mixed Batch';
    END IF;
    
    -- Otherwise, any valid fish type is acceptable
    RETURN EXISTS (
        SELECT 1 FROM fish_type_averages 
        WHERE fish_type = p_fish_type
    );
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create function to get fish count estimation for processing
CREATE OR REPLACE FUNCTION estimate_processing_fish_count(
    p_weight DECIMAL(10,2),
    p_fish_type VARCHAR(100),
    p_warehouse_entry_id UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    warehouse_pieces INTEGER;
    estimated_count INTEGER;
    avg_weight DECIMAL(4,3);
BEGIN
    -- First, try to get actual pieces from warehouse entry
    IF p_warehouse_entry_id IS NOT NULL THEN
        SELECT total_pieces INTO warehouse_pieces
        FROM warehouse_entries
        WHERE id = p_warehouse_entry_id;
        
        IF warehouse_pieces IS NOT NULL AND warehouse_pieces > 0 THEN
            RETURN warehouse_pieces;
        END IF;
    END IF;
    
    -- If no warehouse pieces, estimate based on fish type
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

-- Step 5: Create trigger to auto-populate fish type and count when processing record is created
CREATE OR REPLACE FUNCTION auto_populate_processing_fish_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-populate fish type from warehouse entry if not specified
    IF NEW.fish_type IS NULL OR NEW.fish_type = '' THEN
        NEW.fish_type := inherit_fish_type_from_warehouse(NEW.warehouse_entry_id);
    END IF;
    
    -- Auto-populate fish count if not specified
    IF NEW.ready_for_dispatch_count IS NULL OR NEW.ready_for_dispatch_count = 0 THEN
        NEW.ready_for_dispatch_count := estimate_processing_fish_count(
            NEW.post_processing_weight, 
            NEW.fish_type, 
            NEW.warehouse_entry_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger for processing records
DROP TRIGGER IF EXISTS trigger_auto_populate_processing_fish_data ON processing_records;
CREATE TRIGGER trigger_auto_populate_processing_fish_data
    BEFORE INSERT OR UPDATE ON processing_records
    FOR EACH ROW
    EXECUTE FUNCTION auto_populate_processing_fish_data();

-- Step 7: Update existing processing records with fish type from warehouse entries
UPDATE processing_records 
SET fish_type = inherit_fish_type_from_warehouse(warehouse_entry_id)
WHERE fish_type IS NULL OR fish_type = 'Mixed Batch';

-- Step 8: Recalculate fish counts for existing processing records using fish type
UPDATE processing_records 
SET ready_for_dispatch_count = estimate_processing_fish_count(
    post_processing_weight, 
    fish_type, 
    warehouse_entry_id
)
WHERE ready_for_dispatch_count IS NULL OR ready_for_dispatch_count = 0;

-- Step 9: Create view for processing form data
CREATE OR REPLACE VIEW processing_form_data AS
SELECT 
    pr.id,
    pr.processing_date,
    pr.post_processing_weight,
    pr.ready_for_dispatch_count,
    pr.fish_type,
    pr.warehouse_entry_id,
    we.entry_date as warehouse_entry_date,
    we.total_weight as warehouse_weight,
    we.total_pieces as warehouse_pieces,
    we.fish_type as warehouse_fish_type,
    f.name as farmer_name,
    fta.average_weight_kg,
    fta.description as fish_type_description,
    CASE 
        WHEN we.total_pieces IS NOT NULL AND we.total_pieces > 0 THEN 'From warehouse pieces'
        ELSE 'Estimated from fish type'
    END as fish_count_source
FROM processing_records pr
LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
LEFT JOIN farmers f ON we.farmer_id = f.id
LEFT JOIN fish_type_averages fta ON pr.fish_type = fta.fish_type;

-- Step 10: Show updated processing records analysis
SELECT 
    'Updated processing records analysis:' as analysis,
    COUNT(*) as total_records,
    COUNT(fish_type) as records_with_fish_type,
    COUNT(ready_for_dispatch_count) as records_with_fish_count,
    AVG(ready_for_dispatch_count) as avg_fish_count
FROM processing_records;

-- Step 11: Show processing records by fish type
SELECT 
    'Processing records by fish type:' as processing_analysis,
    fish_type,
    COUNT(*) as count,
    AVG(post_processing_weight) as avg_weight,
    AVG(ready_for_dispatch_count) as avg_fish_count,
    ROUND(AVG(post_processing_weight / ready_for_dispatch_count), 3) as avg_weight_per_fish
FROM processing_records
WHERE fish_type IS NOT NULL AND ready_for_dispatch_count > 0
GROUP BY fish_type
ORDER BY count DESC;

-- Step 12: Show accuracy comparison
SELECT 
    'Accuracy comparison - Expected vs Actual:' as accuracy,
    pr.fish_type,
    COUNT(*) as records,
    fta.average_weight_kg as expected_avg_weight,
    ROUND(AVG(pr.post_processing_weight / pr.ready_for_dispatch_count), 3) as actual_avg_weight,
    ROUND(
        (AVG(pr.post_processing_weight / pr.ready_for_dispatch_count) - fta.average_weight_kg) / fta.average_weight_kg * 100, 
        1
    ) as accuracy_percentage
FROM processing_records pr
JOIN fish_type_averages fta ON pr.fish_type = fta.fish_type
WHERE pr.ready_for_dispatch_count > 0
GROUP BY pr.fish_type, fta.average_weight_kg
ORDER BY accuracy_percentage;

-- Step 13: Show records ready for sorting by fish type
SELECT 
    'Records ready for sorting by fish type:' as sorting_ready,
    pr.fish_type,
    COUNT(*) as count,
    SUM(pr.ready_for_dispatch_count) as total_fish_count,
    SUM(pr.post_processing_weight) as total_weight
FROM processing_records pr
WHERE pr.ready_for_dispatch_count > 0 
AND pr.post_processing_weight > 0
AND NOT EXISTS (
    SELECT 1 FROM sorting_batches sb 
    WHERE sb.processing_record_id = pr.id 
    AND sb.status = 'completed'
)
GROUP BY pr.fish_type
ORDER BY count DESC;

-- Step 14: Create sample processing record for testing
INSERT INTO processing_records (
    processing_date, pre_processing_weight, post_processing_weight, processing_waste, ready_for_dispatch_count, 
    fish_type, warehouse_entry_id, processed_by
) VALUES 
    (CURRENT_DATE, 25.0, 22.5, 2.5, NULL, NULL, 
     (SELECT id FROM warehouse_entries WHERE fish_type = 'Nile Tilapia' LIMIT 1), 
     (SELECT id FROM profiles LIMIT 1))
ON CONFLICT DO NOTHING;

-- Step 15: Show final results
SELECT 
    'Processing form fish type implementation completed!' as status,
    COUNT(*) as total_records,
    COUNT(fish_type) as records_with_fish_type,
    COUNT(ready_for_dispatch_count) as records_with_fish_count,
    COUNT(DISTINCT fish_type) as unique_fish_types
FROM processing_records;

SELECT 'Fish type tracking for processing records completed successfully!' as final_status;
