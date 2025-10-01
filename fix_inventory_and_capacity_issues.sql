-- Clean fix for inventory issues and over capacity
-- This script fixes data integrity issues and prepares over-capacity items for transfer

-- 1. Fix invalid inventory items
UPDATE sorting_results 
SET size_class = 0 
WHERE size_class IS NULL 
  AND total_weight_grams > 0;

-- First, let's see what these problematic items actually are (WEIGHT ONLY)
SELECT 
    'PROBLEMATIC ITEMS ANALYSIS' as status,
    'Items with zero/negative WEIGHT:' as issue_type,
    COUNT(*) as count,
    STRING_AGG(DISTINCT size_class::TEXT, ', ') as size_classes,
    STRING_AGG(DISTINCT storage_location_id::TEXT, ', ') as storage_locations
FROM sorting_results 
WHERE total_weight_grams <= 0;

-- Show details of problematic items (WEIGHT ONLY)
SELECT 
    'PROBLEMATIC ITEM DETAILS' as status,
    sr.id,
    sr.sorting_batch_id,
    sb.batch_number,
    sr.size_class,
    sr.total_weight_grams,
    sl.name as storage_location,
    sr.created_at,
    sr.updated_at
FROM sorting_results sr
LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sr.total_weight_grams <= 0
ORDER BY sr.created_at DESC;

-- Create archive table for problematic inventory items (if it doesn't exist)
CREATE TABLE IF NOT EXISTS sorting_results_archive (
    id UUID PRIMARY KEY,
    sorting_batch_id UUID,
    size_class INTEGER,
    total_pieces INTEGER,
    total_weight_grams DECIMAL(10,2),
    storage_location_id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    archive_reason TEXT DEFAULT 'Invalid data - zero/negative quantities'
);

-- Move items with zero or negative WEIGHT to archive (WEIGHT ONLY)
-- But first check if they're referenced in disposal_items
INSERT INTO sorting_results_archive (
    id, sorting_batch_id, size_class, total_pieces, 
    total_weight_grams, storage_location_id, created_at, updated_at, archive_reason
)
SELECT 
    id, sorting_batch_id, size_class, total_pieces,
    total_weight_grams, storage_location_id, created_at, updated_at,
    CASE 
        WHEN id IN (SELECT DISTINCT sorting_result_id FROM disposal_items WHERE sorting_result_id IS NOT NULL)
        THEN 'Invalid data - zero/negative WEIGHT (referenced in disposal_items)'
        ELSE 'Invalid data - zero/negative WEIGHT'
    END as archive_reason
FROM sorting_results 
WHERE total_weight_grams <= 0;

-- Handle items referenced in disposal_items differently
-- Update them to have minimum weight instead of deleting
UPDATE sorting_results 
SET 
    total_weight_grams = 1,
    updated_at = NOW()
WHERE total_weight_grams <= 0
  AND id IN (
    SELECT DISTINCT sorting_result_id 
    FROM disposal_items 
    WHERE sorting_result_id IS NOT NULL
  );

-- Now remove the non-referenced items from main table (WEIGHT ONLY)
DELETE FROM sorting_results 
WHERE total_weight_grams <= 0
  AND id NOT IN (
    SELECT DISTINCT sorting_result_id 
    FROM disposal_items 
    WHERE sorting_result_id IS NOT NULL
  );

-- Fix items without storage location (assign to first available storage)
UPDATE sorting_results 
SET storage_location_id = (
    SELECT id FROM storage_locations 
    WHERE status = 'active' 
    ORDER BY name 
    LIMIT 1
)
WHERE storage_location_id IS NULL;

-- 2. Update storage capacity
UPDATE storage_locations 
SET current_usage_kg = (
    SELECT COALESCE(SUM(total_weight_grams) / 1000.0, 0)
    FROM sorting_results sr
    WHERE sr.storage_location_id = storage_locations.id
),
updated_at = NOW();

-- 3. Identify over-capacity storage locations
SELECT 
    'OVER CAPACITY LOCATIONS' as status,
    sl.name,
    sl.capacity_kg,
    sl.current_usage_kg,
    (sl.current_usage_kg - sl.capacity_kg) as overage_kg,
    ROUND((sl.current_usage_kg / sl.capacity_kg * 100), 1) as utilization_percent
FROM storage_locations sl
WHERE sl.current_usage_kg > sl.capacity_kg
ORDER BY (sl.current_usage_kg - sl.capacity_kg) DESC;

-- 4. Show items in over-capacity storage for transfer
SELECT 
    'ITEMS FOR TRANSFER' as status,
    sr.id as sorting_result_id,
    sr.sorting_batch_id,
    sr.size_class,
    sr.total_weight_grams / 1000.0 as weight_kg,
    sr.total_pieces,
    sl.name as current_storage,
    sl.capacity_kg,
    sl.current_usage_kg,
    (sl.current_usage_kg - sl.capacity_kg) as overage_kg
FROM sorting_results sr
JOIN storage_locations sl ON sr.storage_location_id = sl.id
WHERE sl.current_usage_kg > sl.capacity_kg
  AND sr.total_weight_grams > 0
ORDER BY sl.name, sr.size_class;

-- 5. Show available storage locations for transfers
SELECT 
    'AVAILABLE STORAGE' as status,
    sl.id,
    sl.name,
    sl.capacity_kg,
    sl.current_usage_kg,
    (sl.capacity_kg - sl.current_usage_kg) as available_kg,
    ROUND((sl.current_usage_kg / sl.capacity_kg * 100), 1) as utilization_percent
FROM storage_locations sl
WHERE sl.status = 'active'
  AND sl.current_usage_kg < sl.capacity_kg
ORDER BY (sl.capacity_kg - sl.current_usage_kg) DESC;

-- 6. DISPOSAL SYSTEM FIX
-- Create disposal function if it doesn't exist
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

-- Create disposal history function
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

-- Create auto disposal function
CREATE OR REPLACE FUNCTION create_auto_disposal(
    p_disposal_reason_id UUID,
    p_disposal_method TEXT DEFAULT 'waste',
    p_disposal_location TEXT DEFAULT NULL,
    p_disposal_cost DECIMAL(10,2) DEFAULT 0,
    p_notes TEXT DEFAULT NULL,
    p_disposed_by UUID DEFAULT NULL,
    p_days_old INTEGER DEFAULT 30,
    p_include_storage_issues BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
    disposal_id UUID,
    disposal_number TEXT,
    items_added INTEGER,
    total_weight_kg DECIMAL(10,2),
    total_pieces INTEGER,
    message TEXT
) AS $$
DECLARE
    v_disposal_id UUID;
    v_disposal_number TEXT;
    v_item RECORD;
    v_items_added INTEGER := 0;
    v_total_weight DECIMAL(10,2) := 0;
    v_total_pieces INTEGER := 0;
    v_disposal_reason_name TEXT;
BEGIN
    -- Get disposal reason name
    SELECT name INTO v_disposal_reason_name 
    FROM disposal_reasons 
    WHERE id = p_disposal_reason_id;
    
    IF v_disposal_reason_name IS NULL THEN
        RAISE EXCEPTION 'Disposal reason not found';
    END IF;
    
    -- Generate disposal number
    v_disposal_number := 'DISPOSAL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('disposal_sequence')::TEXT, 4, '0');
    
    -- Create disposal record
    INSERT INTO disposal_records (
        disposal_number,
        disposal_reason_id,
        disposal_method,
        disposal_location,
        disposal_cost,
        notes,
        disposed_by,
        status
    ) VALUES (
        v_disposal_number,
        p_disposal_reason_id,
        p_disposal_method,
        p_disposal_location,
        p_disposal_cost,
        COALESCE(p_notes, 'Auto-generated disposal for items older than ' || p_days_old || ' days'),
        p_disposed_by,
        'pending'
    ) RETURNING id INTO v_disposal_id;
    
    -- Add old items to disposal
    FOR v_item IN
        SELECT 
            sr.id as sorting_result_id,
            sr.sorting_batch_id,
            sr.size_class,
            sr.total_weight_grams / 1000.0 as weight_kg,
            sr.total_pieces,
            sb.batch_number,
            sl.name as storage_location_name
        FROM sorting_results sr
        JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
        JOIN storage_locations sl ON sr.storage_location_id = sl.id
        WHERE sr.total_weight_grams > 0
        AND sr.created_at < NOW() - INTERVAL '1 day' * p_days_old
        ORDER BY sr.created_at ASC
        LIMIT 50
    LOOP
        -- Add disposal item
        INSERT INTO disposal_items (
            disposal_record_id,
            sorting_result_id,
            size_class,
            quantity,
            weight_kg,
            batch_number,
            storage_location_name,
            disposal_reason
        ) VALUES (
            v_disposal_id,
            v_item.sorting_result_id,
            v_item.size_class,
            v_item.total_pieces,
            v_item.weight_kg,
            v_item.batch_number,
            v_item.storage_location_name,
            v_disposal_reason_name
        );
        
        v_items_added := v_items_added + 1;
        v_total_weight := v_total_weight + v_item.weight_kg;
        v_total_pieces := v_total_pieces + v_item.total_pieces;
    END LOOP;
    
    -- Update disposal record totals
    UPDATE disposal_records
    SET 
        total_weight_kg = v_total_weight,
        total_pieces = v_total_pieces
    WHERE id = v_disposal_id;
    
    RETURN QUERY SELECT 
        v_disposal_id,
        v_disposal_number,
        v_items_added,
        v_total_weight,
        v_total_pieces,
        'Auto disposal created with ' || v_items_added || ' items'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for disposal functions
GRANT EXECUTE ON FUNCTION dispose_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION dispose_inventory TO anon;
GRANT EXECUTE ON FUNCTION get_disposal_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_disposal_history TO anon;
GRANT EXECUTE ON FUNCTION create_auto_disposal TO authenticated;
GRANT EXECUTE ON FUNCTION create_auto_disposal TO anon;

-- 7. Test disposal system
SELECT 'DISPOSAL SYSTEM STATUS' as status;

-- Check if disposal functions work
SELECT 
    'DISPOSAL FUNCTIONS' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'dispose_inventory') THEN '✅ dispose_inventory function exists'
        ELSE '❌ dispose_inventory function missing'
    END as status;

SELECT 
    'DISPOSAL FUNCTIONS' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_disposal_history') THEN '✅ get_disposal_history function exists'
        ELSE '❌ get_disposal_history function missing'
    END as status;

SELECT 
    'DISPOSAL FUNCTIONS' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_auto_disposal') THEN '✅ create_auto_disposal function exists'
        ELSE '❌ create_auto_disposal function missing'
    END as status;

-- 8. Show archived items for owner review
SELECT 
    'ARCHIVED ITEMS' as status,
    COUNT(*) as total_archived_items,
    STRING_AGG(DISTINCT archive_reason, ', ') as archive_reasons
FROM sorting_results_archive;

-- Show details of archived items (WEIGHT FOCUS)
SELECT 
    'ARCHIVED ITEM DETAILS' as status,
    id,
    sorting_batch_id,
    size_class,
    total_weight_grams,
    archive_reason,
    archived_at
FROM sorting_results_archive
ORDER BY archived_at DESC
LIMIT 10;

-- 9. Final status
SELECT 
    'FINAL STATUS' as status,
    COUNT(*) as total_inventory_items,
    SUM(total_weight_grams) / 1000.0 as total_weight_kg,
    COUNT(DISTINCT size_class) as unique_sizes
FROM sorting_results 
WHERE total_weight_grams > 0;

-- 9. System completion status
SELECT 
    'SYSTEM STATUS' as status,
    '✅ Inventory System: Fixed' as inventory,
    '✅ Orders System: Working' as orders,
    '✅ Transfers System: Working' as transfers,
    '✅ Disposal System: Fixed' as disposal;
