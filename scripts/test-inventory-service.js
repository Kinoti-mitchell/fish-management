// Test the inventory service to see what data it returns
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './env.development' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Simulate the inventory service logic
async function testInventoryService() {
  console.log('🔍 Testing inventory service logic...\n');
  
  try {
    // Get storage locations mapping
    const { data: storageLocations, error: storageError } = await supabase
      .from('storage_locations')
      .select('id, name');
    
    if (storageError) throw storageError;
    
    const storageMap = new Map();
    storageLocations?.forEach((location) => {
      storageMap.set(location.id, location.name);
    });
    
    console.log('📊 Storage locations map:', Object.fromEntries(storageMap));
    
    // Get sorting results (same as inventory service)
    const { data: sortingResults, error } = await supabase
      .from('sorting_results')
      .select(`
        id,
        size_class,
        total_pieces,
        total_weight_grams,
        storage_location_id,
        sorting_batch_id,
        transfer_source_storage_id,
        transfer_source_storage_name,
        transfer_id,
        sorting_batch:sorting_batches(
          id,
          batch_number,
          status,
          created_at,
          processing_record:processing_records(
            id,
            processing_date,
            warehouse_entry:warehouse_entries(
              id,
              entry_date,
              farmer_id,
              farmers(name, phone, location)
            )
          )
        )
      `)
      .not('storage_location_id', 'is', null)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    console.log('📦 Raw sorting results:', sortingResults?.length || 0);
    
    // Filter for completed batches only (same as inventory service)
    const completedSortingResults = (sortingResults || []).filter((result) => 
      result.sorting_batch && result.sorting_batch.status === 'completed'
    );
    
    console.log('✅ Completed sorting results:', completedSortingResults.length);
    
    // Aggregate the data by storage location and size (same as inventory service)
    const storageAggregation = {};
    
    completedSortingResults.forEach((result) => {
      const storageId = result.storage_location_id || 'unknown';
      const storageName = storageMap.get(storageId) || 'Unknown Storage';
      const size = result.size_class;
      const quantity = result.total_pieces || 0;
      const weightKg = (result.total_weight_grams || 0) / 1000;
      
      if (quantity > 0) {
        if (!storageAggregation[storageId]) {
          storageAggregation[storageId] = {
            storage_location_id: storageId,
            storage_location_name: storageName,
            sizes: {}
          };
        }
        
        if (!storageAggregation[storageId].sizes[size]) {
          storageAggregation[storageId].sizes[size] = {
            total_quantity: 0,
            total_weight_kg: 0,
            batch_count: 0,
            contributing_batches: []
          };
        }
        
        storageAggregation[storageId].sizes[size].total_quantity += quantity;
        storageAggregation[storageId].sizes[size].total_weight_kg += weightKg;
        storageAggregation[storageId].sizes[size].batch_count += 1;
        
        const isTransfer = !!result.transfer_id && result.transfer_source_storage_name;
        storageAggregation[storageId].sizes[size].contributing_batches.push({
          batch_id: result.sorting_batch_id,
          batch_number: result.sorting_batch?.batch_number || `BATCH-${result.sorting_batch_id?.slice(-8).toUpperCase()}`,
          quantity: quantity,
          weight_kg: weightKg,
          storage_location_name: storageName,
          farmer_name: isTransfer 
            ? `${result.sorting_batch?.processing_record?.warehouse_entry?.farmers?.name || 'Unknown'} (Transferred from ${result.transfer_source_storage_name})`
            : result.sorting_batch?.processing_record?.warehouse_entry?.farmers?.name || 'Unknown',
          processing_date: result.sorting_batch?.processing_record?.processing_date || 'Unknown',
          added_date: result.sorting_batch?.created_at || new Date().toISOString(),
          created_at: result.sorting_batch?.created_at || new Date().toISOString(),
          ...(isTransfer && {
            is_transfer: true,
            transfer_id: result.transfer_id,
            transfer_source_storage_id: result.transfer_source_storage_id,
            transfer_source_storage_name: result.transfer_source_storage_name
          })
        });
      }
    });
    
    console.log('📊 Storage aggregation:', Object.keys(storageAggregation).length, 'storages');
    
    // Convert to final format (same as inventory service)
    const finalResult = [];
    Object.values(storageAggregation).forEach((storage) => {
      Object.entries(storage.sizes).forEach(([size, data]) => {
        finalResult.push({
          storage_location_id: storage.storage_location_id,
          storage_location_name: storage.storage_location_name,
          size: parseInt(size),
          total_quantity: data.total_quantity,
          total_weight_kg: data.total_weight_kg,
          batch_count: data.batch_count,
          contributing_batches: data.contributing_batches
        });
      });
    });
    
    console.log('🎯 Final inventory result:', finalResult.length, 'items');
    
    // Show sample data
    if (finalResult.length > 0) {
      console.log('\n📦 Sample inventory items:');
      finalResult.slice(0, 5).forEach(item => {
        console.log(`  - ${item.storage_location_name} - Size ${item.size}: ${item.total_quantity} pieces (${item.total_weight_kg.toFixed(2)}kg)`);
        console.log(`    Batches: ${item.batch_count}, Contributing: ${item.contributing_batches.length}`);
      });
    }
    
    // Check for potential issues
    console.log('\n🔍 Analysis:');
    console.log(`  - Total sorting results: ${sortingResults?.length || 0}`);
    console.log(`  - Completed results: ${completedSortingResults.length}`);
    console.log(`  - Final inventory items: ${finalResult.length}`);
    console.log(`  - Storage locations: ${Object.keys(storageAggregation).length}`);
    
    if (finalResult.length === 0) {
      console.log('❌ No inventory items generated - possible issues:');
      console.log('   - No completed sorting batches');
      console.log('   - No sorting results with storage_location_id');
      console.log('   - All quantities are 0');
    } else {
      console.log('✅ Inventory items generated successfully!');
    }
    
    return finalResult;
    
  } catch (error) {
    console.log('❌ Error in inventory service test:', error);
    return [];
  }
}

async function runTest() {
  console.log('🚀 Testing inventory service...\n');
  const result = await testInventoryService();
  console.log('\n🏁 Test complete!');
  return result;
}

runTest().catch(console.error);
