-- Create automatic inventory update when sorting batch is completed
-- This ensures inventory is updated immediately when fish are sorted and assigned to storage

-- 1. Create function to automatically add to inventory when sorting batch is completed
CREATE OR REPLACE FUNCTION auto_add_to_inventory_on_sorting_complete()
RETURNS TRIGGER AS $$
DECLARE
    v_size_key TEXT;
    v_quantity INTEGER;
    v_inventory_size INTEGER;
    v_weight_kg DECIMAL(10,2);
    v_storage_location_id UUID;
BEGIN
    -- Only process when status changes to 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- Get storage location from the batch
        v_storage_location_id := NEW.storage_location_id;
        
        -- Process each size in the size_distribution
        IF NEW.size_distribution IS NOT NULL AND NEW.size_distribution != '{}'::JSONB THEN
            FOR v_size_key, v_quantity IN 
                SELECT key, value::INTEGER 
                FROM jsonb_each_text(NEW.size_distribution)
                WHERE value::INTEGER > 0
            LOOP
                v_inventory_size := v_size_key::INTEGER;
                
                -- Validate size
                IF v_inventory_size >= 0 AND v_inventory_size <= 10 THEN
                    
                    -- Calculate weight for this size (estimate based on average weight per size)
                    v_weight_kg := v_quantity * CASE v_inventory_size
                        WHEN 0 THEN 0.2  -- Small fish
                        WHEN 1 THEN 0.3
                        WHEN 2 THEN 0.4
                        WHEN 3 THEN 0.5
                        WHEN 4 THEN 0.6
                        WHEN 5 THEN 0.7
                        WHEN 6 THEN 0.8
                        WHEN 7 THEN 0.9
                        WHEN 8 THEN 1.0
                        WHEN 9 THEN 1.1
                        WHEN 10 THEN 1.2  -- Large fish
                        ELSE 0.5
                    END;
                    
                    -- Insert or update inventory_with_storage if the table exists
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_with_storage') THEN
                        INSERT INTO inventory_with_storage (storage_location_id, size, quantity, total_weight_kg, average_weight_per_fish)
                        VALUES (v_storage_location_id, v_inventory_size, v_quantity, v_weight_kg, v_weight_kg / v_quantity)
                        ON CONFLICT (storage_location_id, size) 
                        DO UPDATE SET 
                            quantity = inventory_with_storage.quantity + v_quantity,
                            total_weight_kg = inventory_with_storage.total_weight_kg + v_weight_kg,
                            average_weight_per_fish = (inventory_with_storage.total_weight_kg + v_weight_kg) / (inventory_with_storage.quantity + v_quantity),
                            last_updated = NOW(),
                            updated_at = NOW();
                        
                        -- Log the entry
                        INSERT INTO inventory_entries_with_storage (storage_location_id, size, quantity_change, entry_type, reference_id, notes)
                        VALUES (v_storage_location_id, v_inventory_size, v_quantity, 'sorting', NEW.id, 
                                'Auto-added from sorting batch - ' || NEW.batch_number);
                    ELSE
                        -- Fallback to regular inventory table if inventory_with_storage doesn't exist
                        INSERT INTO inventory (size, quantity)
                        VALUES (v_inventory_size, v_quantity)
                        ON CONFLICT (size) 
                        DO UPDATE SET 
                            quantity = inventory.quantity + v_quantity,
                            updated_at = NOW();
                        
                        -- Log the entry
                        INSERT INTO inventory_entries (size, quantity_change, entry_type, reference_id, notes)
                        VALUES (v_inventory_size, v_quantity, 'sorting', NEW.id, 
                                'Auto-added from sorting batch - ' || NEW.batch_number);
                    END IF;
                END IF;
            END LOOP;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create trigger to automatically update inventory when sorting batch is completed
DROP TRIGGER IF EXISTS trigger_auto_add_to_inventory ON sorting_batches;

CREATE TRIGGER trigger_auto_add_to_inventory
    AFTER INSERT OR UPDATE ON sorting_batches
    FOR EACH ROW
    EXECUTE FUNCTION auto_add_to_inventory_on_sorting_complete();

-- 3. Create function to manually add existing completed batches to inventory
CREATE OR REPLACE FUNCTION add_existing_completed_batches_to_inventory()
RETURNS TABLE(
    batch_id UUID,
    batch_number TEXT,
    status TEXT,
    added_to_inventory BOOLEAN
) AS $$
DECLARE
    v_batch RECORD;
    v_size_key TEXT;
    v_quantity INTEGER;
    v_inventory_size INTEGER;
    v_weight_kg DECIMAL(10,2);
    v_storage_location_id UUID;
    v_already_added BOOLEAN;
BEGIN
    -- Process all completed batches that haven't been added to inventory yet
    FOR v_batch IN 
        SELECT sb.*
        FROM sorting_batches sb
        WHERE sb.status = 'completed'
        AND sb.size_distribution IS NOT NULL
        AND sb.size_distribution != '{}'::JSONB
        AND NOT EXISTS (
            SELECT 1 FROM inventory_entries ie 
            WHERE ie.reference_id = sb.id 
            AND ie.entry_type = 'sorting'
        )
        ORDER BY sb.created_at
    LOOP
        v_already_added := FALSE;
        v_storage_location_id := v_batch.storage_location_id;
        
        -- Process each size in the size_distribution
        FOR v_size_key, v_quantity IN 
            SELECT key, value::INTEGER 
            FROM jsonb_each_text(v_batch.size_distribution)
            WHERE value::INTEGER > 0
        LOOP
            v_inventory_size := v_size_key::INTEGER;
            
            -- Validate size
            IF v_inventory_size >= 0 AND v_inventory_size <= 10 THEN
                
                -- Calculate weight for this size
                v_weight_kg := v_quantity * CASE v_inventory_size
                    WHEN 0 THEN 0.2
                    WHEN 1 THEN 0.3
                    WHEN 2 THEN 0.4
                    WHEN 3 THEN 0.5
                    WHEN 4 THEN 0.6
                    WHEN 5 THEN 0.7
                    WHEN 6 THEN 0.8
                    WHEN 7 THEN 0.9
                    WHEN 8 THEN 1.0
                    WHEN 9 THEN 1.1
                    WHEN 10 THEN 1.2
                    ELSE 0.5
                END;
                
                -- Insert or update inventory_with_storage if the table exists
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_with_storage') THEN
                    INSERT INTO inventory_with_storage (storage_location_id, size, quantity, total_weight_kg, average_weight_per_fish)
                    VALUES (v_storage_location_id, v_inventory_size, v_quantity, v_weight_kg, v_weight_kg / v_quantity)
                    ON CONFLICT (storage_location_id, size) 
                    DO UPDATE SET 
                        quantity = inventory_with_storage.quantity + v_quantity,
                        total_weight_kg = inventory_with_storage.total_weight_kg + v_weight_kg,
                        average_weight_per_fish = (inventory_with_storage.total_weight_kg + v_weight_kg) / (inventory_with_storage.quantity + v_quantity),
                        last_updated = NOW(),
                        updated_at = NOW();
                    
                    -- Log the entry
                    INSERT INTO inventory_entries_with_storage (storage_location_id, size, quantity_change, entry_type, reference_id, notes)
                    VALUES (v_storage_location_id, v_inventory_size, v_quantity, 'sorting', v_batch.id, 
                            'Retroactively added from sorting batch - ' || v_batch.batch_number);
                ELSE
                    -- Fallback to regular inventory table
                    INSERT INTO inventory (size, quantity)
                    VALUES (v_inventory_size, v_quantity)
                    ON CONFLICT (size) 
                    DO UPDATE SET 
                        quantity = inventory.quantity + v_quantity,
                        updated_at = NOW();
                    
                    -- Log the entry
                    INSERT INTO inventory_entries (size, quantity_change, entry_type, reference_id, notes)
                    VALUES (v_inventory_size, v_quantity, 'sorting', v_batch.id, 
                            'Retroactively added from sorting batch - ' || v_batch.batch_number);
                END IF;
                
                v_already_added := TRUE;
            END IF;
        END LOOP;
        
        -- Return the batch info
        RETURN QUERY SELECT v_batch.id, v_batch.batch_number, v_batch.status, v_already_added;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION auto_add_to_inventory_on_sorting_complete TO authenticated;
GRANT EXECUTE ON FUNCTION add_existing_completed_batches_to_inventory TO authenticated;
