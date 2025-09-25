-- Complete Inventory Setup Script
-- This script creates all necessary functions for inventory storage management

-- Step 1: Create the storage capacity update function
CREATE OR REPLACE FUNCTION update_storage_capacity_from_inventory()
RETURNS BOOLEAN AS $$
DECLARE
    v_storage_location RECORD;
    v_actual_usage DECIMAL(10,2);
BEGIN
    -- Update each storage location with actual inventory usage
    FOR v_storage_location IN
        SELECT sl.id, sl.name
        FROM storage_locations sl
        WHERE sl.status = 'active'
    LOOP
        -- Calculate actual usage from sorting_results
        SELECT COALESCE(SUM(sr.total_weight_grams) / 1000.0, 0) INTO v_actual_usage
        FROM sorting_results sr
        WHERE sr.storage_location_id = v_storage_location.id;
        
        -- Update storage location with actual usage
        UPDATE storage_locations
        SET current_usage_kg = v_actual_usage,
            updated_at = NOW()
        WHERE id = v_storage_location.id;
        
        RAISE NOTICE 'Updated % usage to %kg', v_storage_location.name, v_actual_usage;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Ensure storage locations exist (handle existing locations)
INSERT INTO storage_locations (id, name, location_type, capacity_kg, status) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Cold Storage A', 'cold_storage', 2000, 'active'),
    ('22222222-2222-2222-2222-222222222222', 'Cold Storage B', 'cold_storage', 1500, 'active'),
    ('33333333-3333-3333-3333-333333333333', 'Freezer Unit 1', 'freezer', 1000, 'active'),
    ('44444444-4444-4444-4444-444444444444', 'Processing Area 1', 'processing', 500, 'active'),
    ('55555555-5555-5555-5555-555555555555', 'Processing Area 2', 'processing', 500, 'active')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    location_type = EXCLUDED.location_type,
    capacity_kg = EXCLUDED.capacity_kg,
    status = EXCLUDED.status,
    updated_at = NOW()
ON CONFLICT (name) DO UPDATE SET
    location_type = EXCLUDED.location_type,
    capacity_kg = EXCLUDED.capacity_kg,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Step 3: Create the main FIFO inventory function
CREATE OR REPLACE FUNCTION get_inventory_with_fifo_ordering()
RETURNS TABLE(
    storage_location_id UUID,
    storage_location_name TEXT,
    storage_location_type TEXT,
    capacity_kg DECIMAL(10,2),
    current_usage_kg DECIMAL(10,2),
    available_capacity_kg DECIMAL(10,2),
    utilization_percent DECIMAL(5,2),
    size INTEGER,
    total_quantity INTEGER,
    total_weight_kg DECIMAL(10,2),
    batch_count INTEGER,
    contributing_batches JSONB,
    fifo_batches JSONB
) AS $$
BEGIN
    -- First update capacity from actual inventory
    PERFORM update_storage_capacity_from_inventory();
    
    RETURN QUERY
    WITH storage_capacity AS (
        SELECT 
            sl.id as storage_location_id,
            sl.name as storage_location_name,
            sl.location_type as storage_location_type,
            sl.capacity_kg,
            sl.current_usage_kg,
            (sl.capacity_kg - sl.current_usage_kg) as available_capacity_kg,
            CASE 
                WHEN sl.capacity_kg > 0 THEN ROUND((sl.current_usage_kg / sl.capacity_kg) * 100, 2)
                ELSE 0
            END as utilization_percent
        FROM storage_locations sl
        WHERE sl.status = 'active'
    ),
    inventory_by_size AS (
        SELECT 
            sr.storage_location_id,
            sr.size_class as size,
            SUM(sr.total_pieces) as total_quantity,
            SUM(sr.total_weight_grams) / 1000.0 as total_weight_kg,
            COUNT(DISTINCT sr.sorting_batch_id) as batch_count,
            JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'batch_id', sr.sorting_batch_id,
                    'batch_number', sb.batch_number,
                    'quantity', sr.total_pieces,
                    'weight_kg', sr.total_weight_grams / 1000.0,
                    'created_at', sb.created_at,
                    'processing_date', pr.processing_date,
                    'farmer_name', f.name,
                    'storage_location_name', sl.name
                ) ORDER BY sb.created_at ASC
            ) as contributing_batches,
            JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'batch_id', sr.sorting_batch_id,
                    'batch_number', sb.batch_number,
                    'quantity', sr.total_pieces,
                    'weight_kg', sr.total_weight_grams / 1000.0,
                    'created_at', sb.created_at,
                    'fifo_order', ROW_NUMBER() OVER (PARTITION BY sr.storage_location_id, sr.size_class ORDER BY sb.created_at ASC)
                ) ORDER BY sb.created_at ASC
            ) as fifo_batches
        FROM sorting_results sr
        JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
        JOIN processing_records pr ON sb.processing_record_id = pr.id
        JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
        JOIN farmers f ON we.farmer_id = f.id
        JOIN storage_locations sl ON sr.storage_location_id = sl.id
        WHERE sb.status = 'completed'
        AND sr.storage_location_id IS NOT NULL
        GROUP BY sr.storage_location_id, sr.size_class
    )
    SELECT 
        sc.storage_location_id,
        sc.storage_location_name,
        sc.storage_location_type,
        sc.capacity_kg,
        sc.current_usage_kg,
        sc.available_capacity_kg,
        sc.utilization_percent,
        ibs.size,
        ibs.total_quantity,
        ibs.total_weight_kg,
        ibs.batch_count,
        ibs.contributing_batches,
        ibs.fifo_batches
    FROM storage_capacity sc
    LEFT JOIN inventory_by_size ibs ON sc.storage_location_id = ibs.storage_location_id
    ORDER BY sc.storage_location_name, ibs.size;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create FIFO order fulfillment function
CREATE OR REPLACE FUNCTION process_fifo_order_fulfillment(
    p_order_id UUID,
    p_size INTEGER,
    p_required_quantity INTEGER,
    p_required_weight_kg DECIMAL(10,2)
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    allocated_batches JSONB,
    remaining_quantity INTEGER,
    remaining_weight_kg DECIMAL(10,2)
) AS $$
DECLARE
    v_batch RECORD;
    v_allocated_quantity INTEGER := 0;
    v_allocated_weight DECIMAL(10,2) := 0;
    v_allocated_batches JSONB := '[]'::JSONB;
    v_remaining_quantity INTEGER := p_required_quantity;
    v_remaining_weight DECIMAL(10,2) := p_required_weight_kg;
BEGIN
    -- Get batches in FIFO order for the specified size
    FOR v_batch IN
        SELECT 
            sr.sorting_batch_id,
            sb.batch_number,
            sr.total_pieces as available_quantity,
            sr.total_weight_grams / 1000.0 as available_weight_kg,
            sb.created_at,
            sr.storage_location_id,
            sl.name as storage_location_name
        FROM sorting_results sr
        JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
        JOIN storage_locations sl ON sr.storage_location_id = sl.id
        WHERE sr.size_class = p_size
        AND sb.status = 'completed'
        AND sr.storage_location_id IS NOT NULL
        ORDER BY sb.created_at ASC
    LOOP
        -- Check if we still need more inventory
        IF v_remaining_quantity <= 0 AND v_remaining_weight <= 0 THEN
            EXIT;
        END IF;
        
        -- Calculate how much to take from this batch
        DECLARE
            v_take_quantity INTEGER := LEAST(v_remaining_quantity, v_batch.available_quantity);
            v_take_weight DECIMAL(10,2) := LEAST(v_remaining_weight, v_batch.available_weight_kg);
        BEGIN
            -- Add to allocated batches
            v_allocated_batches := v_allocated_batches || JSONB_BUILD_OBJECT(
                'batch_id', v_batch.sorting_batch_id,
                'batch_number', v_batch.batch_number,
                'allocated_quantity', v_take_quantity,
                'allocated_weight_kg', v_take_weight,
                'storage_location_name', v_batch.storage_location_name,
                'created_at', v_batch.created_at
            );
            
            -- Update counters
            v_allocated_quantity := v_allocated_quantity + v_take_quantity;
            v_allocated_weight := v_allocated_weight + v_take_weight;
            v_remaining_quantity := v_remaining_quantity - v_take_quantity;
            v_remaining_weight := v_remaining_weight - v_take_weight;
        END;
    END LOOP;
    
    -- Check if we have enough inventory
    IF v_remaining_quantity > 0 OR v_remaining_weight > 0 THEN
        RETURN QUERY SELECT 
            FALSE,
            'Insufficient inventory available for order'::TEXT,
            v_allocated_batches,
            v_remaining_quantity,
            v_remaining_weight;
    ELSE
        RETURN QUERY SELECT 
            TRUE,
            'Order can be fulfilled with available inventory'::TEXT,
            v_allocated_batches,
            0,
            0.0;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create inventory reduction function for order approval
CREATE OR REPLACE FUNCTION reduce_inventory_on_order_approval(
    p_order_id UUID,
    p_size INTEGER,
    p_quantity INTEGER,
    p_weight_kg DECIMAL(10,2)
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    reduced_batches JSONB
) AS $$
DECLARE
    v_batch RECORD;
    v_remaining_quantity INTEGER := p_quantity;
    v_remaining_weight DECIMAL(10,2) := p_weight_kg;
    v_reduced_batches JSONB := '[]'::JSONB;
BEGIN
    -- Process FIFO reduction
    FOR v_batch IN
        SELECT 
            sr.id as sorting_result_id,
            sr.sorting_batch_id,
            sb.batch_number,
            sr.total_pieces as available_quantity,
            sr.total_weight_grams as available_weight_grams,
            sr.storage_location_id
        FROM sorting_results sr
        JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
        WHERE sr.size_class = p_size
        AND sb.status = 'completed'
        AND sr.storage_location_id IS NOT NULL
        ORDER BY sb.created_at ASC
    LOOP
        -- Check if we still need to reduce more
        IF v_remaining_quantity <= 0 AND v_remaining_weight <= 0 THEN
            EXIT;
        END IF;
        
        -- Calculate how much to reduce from this batch
        DECLARE
            v_reduce_quantity INTEGER := LEAST(v_remaining_quantity, v_batch.available_quantity);
            v_reduce_weight_grams DECIMAL(12,2) := LEAST(v_remaining_weight * 1000, v_batch.available_weight_grams);
        BEGIN
            -- Update the sorting result (reduce inventory)
            UPDATE sorting_results 
            SET 
                total_pieces = total_pieces - v_reduce_quantity,
                total_weight_grams = total_weight_grams - v_reduce_weight_grams,
                updated_at = NOW()
            WHERE id = v_batch.sorting_result_id;
            
            -- Add to reduced batches log
            v_reduced_batches := v_reduced_batches || JSONB_BUILD_OBJECT(
                'batch_id', v_batch.sorting_batch_id,
                'batch_number', v_batch.batch_number,
                'reduced_quantity', v_reduce_quantity,
                'reduced_weight_kg', v_reduce_weight_grams / 1000.0,
                'remaining_quantity', v_batch.available_quantity - v_reduce_quantity,
                'remaining_weight_kg', (v_batch.available_weight_grams - v_reduce_weight_grams) / 1000.0
            );
            
            -- Update counters
            v_remaining_quantity := v_remaining_quantity - v_reduce_quantity;
            v_remaining_weight := v_remaining_weight - (v_reduce_weight_grams / 1000.0);
        END;
    END LOOP;
    
    -- Update storage capacity after inventory reduction
    PERFORM update_storage_capacity_from_inventory();
    
    RETURN QUERY SELECT 
        TRUE,
        'Inventory reduced successfully for order'::TEXT,
        v_reduced_batches;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Grant permissions
GRANT EXECUTE ON FUNCTION update_storage_capacity_from_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_with_fifo_ordering TO authenticated;
GRANT EXECUTE ON FUNCTION process_fifo_order_fulfillment TO authenticated;
GRANT EXECUTE ON FUNCTION reduce_inventory_on_order_approval TO authenticated;

-- Step 7: Run initial capacity update
SELECT 'Updating storage capacity from actual inventory...' as status;
SELECT update_storage_capacity_from_inventory();

-- Step 8: Test the functions
SELECT 'Testing inventory with FIFO ordering...' as test;
SELECT 
    storage_location_name,
    size,
    total_quantity,
    total_weight_kg,
    utilization_percent
FROM get_inventory_with_fifo_ordering()
WHERE size IS NOT NULL
ORDER BY storage_location_name, size
LIMIT 5;

-- Step 9: Show current storage capacity status
SELECT 'Current storage capacity status:' as status;
SELECT 
    storage_location_name,
    capacity_kg,
    current_usage_kg,
    available_capacity_kg,
    utilization_percent,
    CASE 
        WHEN utilization_percent >= 95 THEN 'CRITICAL'
        WHEN utilization_percent >= 80 THEN 'WARNING'
        WHEN utilization_percent >= 50 THEN 'MODERATE'
        ELSE 'AVAILABLE'
    END as status
FROM get_inventory_with_fifo_ordering()
WHERE size IS NULL
ORDER BY utilization_percent DESC;

-- Step 10: Final status
SELECT 
    'Complete inventory setup completed successfully!' as status,
    COUNT(*) as total_storage_locations,
    COUNT(CASE WHEN utilization_percent > 0 THEN 1 END) as locations_with_inventory,
    COUNT(CASE WHEN utilization_percent = 0 THEN 1 END) as empty_locations,
    SUM(current_usage_kg) as total_inventory_weight_kg,
    SUM(capacity_kg) as total_capacity_kg
FROM get_inventory_with_fifo_ordering()
WHERE size IS NULL;
