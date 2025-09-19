#!/usr/bin/env node

/**
 * Deploy Missing RPC Functions - Direct approach
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './server/server.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createStorageCapacityFunction() {
  console.log('📦 Creating update_storage_capacity_from_inventory function...');
  
  const sql = `
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
  `;
  
  try {
    const { error } = await supabase.rpc('exec', { sql });
    if (error) {
      console.log('⚠️  Storage capacity function creation warning:', error.message);
      return false;
    }
    console.log('✅ update_storage_capacity_from_inventory function created');
    return true;
  } catch (err) {
    console.log('⚠️  Storage capacity function creation error:', err.message);
    return false;
  }
}

async function createInventoryFIFOFunction() {
  console.log('📦 Creating get_inventory_with_fifo_ordering function...');
  
  const sql = `
    DROP FUNCTION IF EXISTS get_inventory_with_fifo_ordering();
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
        total_quantity BIGINT,
        total_weight_kg DECIMAL(10,2),
        batch_count BIGINT,
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
                COALESCE(sl.current_usage_kg, 0) as current_usage_kg,
                (sl.capacity_kg - COALESCE(sl.current_usage_kg, 0)) as available_capacity_kg,
                CASE 
                    WHEN sl.capacity_kg > 0 THEN ROUND((COALESCE(sl.current_usage_kg, 0) / sl.capacity_kg) * 100, 2)
                    ELSE 0
                END as utilization_percent
            FROM storage_locations sl
            WHERE sl.status = 'active'
        ),
        inventory_with_fifo AS (
            SELECT 
                sr.storage_location_id,
                sr.size_class as size,
                sr.total_pieces,
                sr.total_weight_grams,
                sr.sorting_batch_id,
                COALESCE(sb.batch_number, 'BATCH-' || SUBSTRING(sr.sorting_batch_id::text, 1, 8)) as batch_number,
                COALESCE(sb.created_at, NOW()) as created_at,
                COALESCE(pr.processing_date, NOW()::date) as processing_date,
                COALESCE(f.name, 'Unknown') as farmer_name,
                COALESCE(sl.name, 'Unknown') as storage_location_name,
                ROW_NUMBER() OVER (
                    PARTITION BY sr.storage_location_id, sr.size_class 
                    ORDER BY COALESCE(sb.created_at, NOW()) ASC
                ) as fifo_order
            FROM sorting_results sr
            LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
            LEFT JOIN processing_records pr ON sb.processing_record_id = pr.id
            LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
            LEFT JOIN farmers f ON we.farmer_id = f.id
            LEFT JOIN storage_locations sl ON sr.storage_location_id = sl.id
            WHERE COALESCE(sb.status, 'completed') = 'completed'
            AND sr.storage_location_id IS NOT NULL
            AND sr.total_pieces > 0
        ),
        inventory_by_size AS (
            SELECT 
                storage_location_id,
                size,
                SUM(total_pieces) as total_quantity,
                SUM(total_weight_grams) / 1000.0 as total_weight_kg,
                COUNT(DISTINCT sorting_batch_id) as batch_count,
                JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                        'batch_id', sorting_batch_id,
                        'batch_number', batch_number,
                        'quantity', total_pieces,
                        'weight_kg', total_weight_grams / 1000.0,
                        'created_at', created_at,
                        'processing_date', processing_date,
                        'farmer_name', farmer_name,
                        'storage_location_name', storage_location_name
                    ) ORDER BY created_at ASC
                ) as contributing_batches,
                JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                        'batch_id', sorting_batch_id,
                        'batch_number', batch_number,
                        'quantity', total_pieces,
                        'weight_kg', total_weight_grams / 1000.0,
                        'created_at', created_at,
                        'fifo_order', fifo_order
                    ) ORDER BY created_at ASC
                ) as fifo_batches
            FROM inventory_with_fifo
            GROUP BY storage_location_id, size
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
  `;
  
  try {
    const { error } = await supabase.rpc('exec', { sql });
    if (error) {
      console.log('⚠️  Inventory FIFO function creation warning:', error.message);
      return false;
    }
    console.log('✅ get_inventory_with_fifo_ordering function created');
    return true;
  } catch (err) {
    console.log('⚠️  Inventory FIFO function creation error:', err.message);
    return false;
  }
}

async function createOutletReceivingFunction() {
  console.log('📦 Creating get_outlet_receiving_records function...');
  
  const sql = `
    DROP FUNCTION IF EXISTS get_outlet_receiving_records();
    CREATE OR REPLACE FUNCTION get_outlet_receiving_records()
    RETURNS TABLE (
        id UUID,
        dispatch_id UUID,
        outlet_order_id UUID,
        received_date DATE,
        received_by UUID,
        expected_weight DECIMAL(10,2),
        actual_weight_received DECIMAL(10,2),
        expected_pieces INTEGER,
        actual_pieces_received INTEGER,
        expected_value DECIMAL(10,2),
        actual_value_received DECIMAL(10,2),
        condition condition_type,
        size_discrepancies JSONB,
        discrepancy_notes TEXT,
        status TEXT,
        outlet_name TEXT,
        outlet_location TEXT,
        created_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE,
        dispatch_destination TEXT,
        dispatch_date DATE,
        order_number TEXT,
        outlet_name_from_order TEXT,
        outlet_location_from_order TEXT
    ) AS $$
    BEGIN
        RETURN QUERY
        SELECT 
            outlet_rec.id,
            outlet_rec.dispatch_id,
            outlet_rec.outlet_order_id,
            outlet_rec.received_date,
            outlet_rec.received_by,
            outlet_rec.expected_weight,
            outlet_rec.actual_weight_received,
            outlet_rec.expected_pieces,
            outlet_rec.actual_pieces_received,
            outlet_rec.expected_value,
            outlet_rec.actual_value_received,
            outlet_rec.condition,
            outlet_rec.size_discrepancies,
            outlet_rec.discrepancy_notes,
            outlet_rec.status,
            outlet_rec.outlet_name,
            outlet_rec.outlet_location,
            outlet_rec.created_at,
            outlet_rec.updated_at,
            dr.destination as dispatch_destination,
            dr.dispatch_date,
            oo.order_number,
            outlet.name as outlet_name_from_order,
            outlet.location as outlet_location_from_order
        FROM outlet_receiving outlet_rec
        LEFT JOIN dispatch_records dr ON outlet_rec.dispatch_id = dr.id
        LEFT JOIN outlet_orders oo ON outlet_rec.outlet_order_id = oo.id
        LEFT JOIN outlets outlet ON oo.outlet_id = outlet.id
        ORDER BY outlet_rec.received_date DESC, outlet_rec.created_at DESC;
    END;
    $$ LANGUAGE plpgsql;
  `;
  
  try {
    const { error } = await supabase.rpc('exec', { sql });
    if (error) {
      console.log('⚠️  Outlet receiving function creation warning:', error.message);
      return false;
    }
    console.log('✅ get_outlet_receiving_records function created');
    return true;
  } catch (err) {
    console.log('⚠️  Outlet receiving function creation error:', err.message);
    return false;
  }
}

async function grantPermissions() {
  console.log('🔐 Granting permissions...');
  
  const permissions = [
    'GRANT EXECUTE ON FUNCTION get_inventory_with_fifo_ordering TO authenticated;',
    'GRANT EXECUTE ON FUNCTION get_outlet_receiving_records TO authenticated;',
    'GRANT EXECUTE ON FUNCTION update_storage_capacity_from_inventory TO authenticated;'
  ];
  
  for (const permission of permissions) {
    try {
      const { error } = await supabase.rpc('exec', { sql: permission });
      if (error) {
        console.log('⚠️  Permission grant warning:', error.message);
      }
    } catch (err) {
      console.log('⚠️  Permission grant error:', err.message);
    }
  }
  
  console.log('✅ Permissions granted');
}

async function testFunctions() {
  console.log('🔍 Testing functions...');
  
  // Test get_inventory_with_fifo_ordering
  try {
    const { data: inventoryData, error: inventoryError } = await supabase.rpc('get_inventory_with_fifo_ordering');
    if (inventoryError) {
      console.log('⚠️  get_inventory_with_fifo_ordering test warning:', inventoryError.message);
    } else {
      console.log('✅ get_inventory_with_fifo_ordering is working!');
      console.log(`📊 Found ${inventoryData?.length || 0} inventory records`);
    }
  } catch (err) {
    console.log('⚠️  get_inventory_with_fifo_ordering test error:', err.message);
  }
  
  // Test get_outlet_receiving_records
  try {
    const { data: receivingData, error: receivingError } = await supabase.rpc('get_outlet_receiving_records');
    if (receivingError) {
      console.log('⚠️  get_outlet_receiving_records test warning:', receivingError.message);
    } else {
      console.log('✅ get_outlet_receiving_records is working!');
      console.log(`📊 Found ${receivingData?.length || 0} receiving records`);
    }
  } catch (err) {
    console.log('⚠️  get_outlet_receiving_records test error:', err.message);
  }
}

async function main() {
  console.log('🚀 Deploying missing RPC functions...\n');
  
  try {
    // Create functions in order
    await createStorageCapacityFunction();
    await createInventoryFIFOFunction();
    await createOutletReceivingFunction();
    
    // Grant permissions
    await grantPermissions();
    
    // Test functions
    await testFunctions();
    
    console.log('\n🎉 RPC functions deployment completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Test your application: npm run dev');
    console.log('2. The 404 errors should now be resolved');
    console.log('3. Check the inventory and outlet receiving pages');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().catch(console.error);
