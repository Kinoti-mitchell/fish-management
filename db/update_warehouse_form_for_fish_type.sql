-- Update Warehouse Entry Form to Include Fish Type Selection
-- This ensures new warehouse entries capture fish type information

-- Step 1: Check current warehouse entries form structure
SELECT 
    'Current warehouse entries analysis:' as analysis,
    COUNT(*) as total_entries,
    COUNT(fish_type) as entries_with_fish_type,
    COUNT(*) - COUNT(fish_type) as entries_without_fish_type
FROM warehouse_entries;

-- Step 2: Show available fish types for reference
SELECT 
    'Available fish types for selection:' as fish_types,
    fish_type,
    average_weight_kg,
    description
FROM fish_type_averages
ORDER BY fish_type;

-- Step 3: Create view for warehouse entry form data
CREATE OR REPLACE VIEW warehouse_entry_form_data AS
SELECT 
    we.id,
    we.entry_date,
    we.total_weight,
    we.total_pieces,
    we.fish_type,
    we.condition,
    we.temperature,
    we.farmer_id,
    f.name as farmer_name,
    we.price_per_kg,
    we.total_value,
    we.notes,
    we.created_at,
    we.updated_at,
    fta.average_weight_kg,
    fta.description as fish_type_description
FROM warehouse_entries we
LEFT JOIN farmers f ON we.farmer_id = f.id
LEFT JOIN fish_type_averages fta ON we.fish_type = fta.fish_type;

-- Step 4: Create function to validate fish type selection
CREATE OR REPLACE FUNCTION validate_fish_type(p_fish_type VARCHAR(100))
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM fish_type_averages 
        WHERE fish_type = p_fish_type
    );
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create function to get fish type suggestions based on weight
CREATE OR REPLACE FUNCTION suggest_fish_type_by_weight(p_weight DECIMAL(10,2))
RETURNS TABLE(
    fish_type VARCHAR(100),
    average_weight_kg DECIMAL(4,3),
    confidence_score DECIMAL(3,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fta.fish_type,
        fta.average_weight_kg,
        CASE 
            WHEN ABS(p_weight / fta.average_weight_kg - ROUND(p_weight / fta.average_weight_kg)) < 0.1 
            THEN 0.9
            WHEN ABS(p_weight / fta.average_weight_kg - ROUND(p_weight / fta.average_weight_kg)) < 0.2 
            THEN 0.7
            ELSE 0.5
        END as confidence_score
    FROM fish_type_averages fta
    WHERE fta.fish_type != 'Mixed Batch' AND fta.fish_type != 'Unknown'
    ORDER BY confidence_score DESC
    LIMIT 3;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger to auto-suggest fish type when weight is entered
CREATE OR REPLACE FUNCTION auto_suggest_fish_type()
RETURNS TRIGGER AS $$
BEGIN
    -- If fish_type is not specified, suggest based on weight
    IF NEW.fish_type IS NULL OR NEW.fish_type = '' THEN
        -- For small weights, suggest small fish
        IF NEW.total_weight <= 20 THEN
            NEW.fish_type := 'Silver Cyprinid';
        -- For medium weights, suggest common fish
        ELSIF NEW.total_weight <= 100 THEN
            NEW.fish_type := 'Nile Tilapia';
        -- For large weights, suggest large fish
        ELSE
            NEW.fish_type := 'Nile Perch';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger for warehouse entries
DROP TRIGGER IF EXISTS trigger_auto_suggest_fish_type ON warehouse_entries;
CREATE TRIGGER trigger_auto_suggest_fish_type
    BEFORE INSERT OR UPDATE ON warehouse_entries
    FOR EACH ROW
    EXECUTE FUNCTION auto_suggest_fish_type();

-- Step 8: Update existing warehouse entries with better fish type suggestions
UPDATE warehouse_entries 
SET fish_type = CASE 
    WHEN total_weight <= 20 THEN 'Silver Cyprinid'
    WHEN total_weight <= 50 THEN 'Nile Tilapia'
    WHEN total_weight <= 100 THEN 'African Catfish'
    WHEN total_weight <= 200 THEN 'Nile Perch'
    ELSE 'Mixed Batch'
END
WHERE fish_type = 'Mixed Batch' OR fish_type IS NULL;

-- Step 9: Show updated fish type distribution
SELECT 
    'Updated fish type distribution:' as distribution,
    fish_type,
    COUNT(*) as count,
    AVG(total_weight) as avg_weight,
    AVG(total_pieces) as avg_pieces,
    MIN(total_weight) as min_weight,
    MAX(total_weight) as max_weight
FROM warehouse_entries
GROUP BY fish_type
ORDER BY count DESC;

-- Step 10: Show fish type suggestions for different weight ranges
SELECT 
    'Fish type suggestions by weight range:' as info,
    '0-20kg' as weight_range,
    'Silver Cyprinid, Blue-spotted Tilapia' as suggested_types
UNION ALL
SELECT 
    'Fish type suggestions by weight range:' as info,
    '20-50kg' as weight_range,
    'Nile Tilapia, African Catfish' as suggested_types
UNION ALL
SELECT 
    'Fish type suggestions by weight range:' as info,
    '50-100kg' as weight_range,
    'African Catfish, Nile Perch' as suggested_types
UNION ALL
SELECT 
    'Fish type suggestions by weight range:' as info,
    '100kg+' as weight_range,
    'Nile Perch, Mixed Batch' as suggested_types;

-- Step 11: Create sample data for testing
INSERT INTO warehouse_entries (
    entry_date, total_weight, total_pieces, fish_type, condition, 
    farmer_id, price_per_kg, total_value, notes
) VALUES 
    (CURRENT_DATE, 25.5, 85, 'Nile Tilapia', 'excellent', 
     (SELECT id FROM farmers LIMIT 1), 15.0, 382.5, 'Fresh tilapia batch'),
    (CURRENT_DATE, 45.0, 30, 'Nile Perch', 'good', 
     (SELECT id FROM farmers LIMIT 1), 25.0, 1125.0, 'Large perch batch'),
    (CURRENT_DATE, 15.0, 100, 'Silver Cyprinid', 'excellent', 
     (SELECT id FROM farmers LIMIT 1), 12.0, 180.0, 'Small fish batch')
ON CONFLICT DO NOTHING;

-- Step 12: Show final results
SELECT 
    'Warehouse entry form fish type implementation completed!' as status,
    COUNT(*) as total_entries,
    COUNT(fish_type) as entries_with_fish_type,
    COUNT(DISTINCT fish_type) as unique_fish_types
FROM warehouse_entries;

SELECT 'Fish type tracking for warehouse entries completed successfully!' as final_status;
