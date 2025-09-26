// Debug script to check why inventory records are not showing
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

async function debugInventoryDisplay() {
  console.log('🔍 Debugging inventory display issues...\n');
  
  try {
    // 1. Check storage locations
    console.log('1️⃣ Checking storage locations...');
    const { data: storageLocations, error: storageError } = await supabase
      .from('storage_locations')
      .select('id, name, location_type, capacity_kg, current_usage_kg, status')
      .order('name');
    
    if (storageError) {
      console.log('❌ Error fetching storage locations:', storageError);
    } else {
      console.log('✅ Storage locations found:', storageLocations?.length || 0);
      storageLocations?.forEach(loc => {
        console.log(`  - ${loc.name} (${loc.location_type}) - Status: ${loc.status}`);
      });
    }
    
    // 2. Check sorting batches
    console.log('\n2️⃣ Checking sorting batches...');
    const { data: sortingBatches, error: batchError } = await supabase
      .from('sorting_batches')
      .select('id, batch_number, status, total_weight_grams, total_pieces, created_at')
      .order('created_at', { ascending: false });
    
    if (batchError) {
      console.log('❌ Error fetching sorting batches:', batchError);
    } else {
      console.log('✅ Sorting batches found:', sortingBatches?.length || 0);
      sortingBatches?.slice(0, 5).forEach(batch => {
        console.log(`  - ${batch.batch_number} - Status: ${batch.status} - Weight: ${batch.total_weight_grams}g`);
      });
    }
    
    // 3. Check sorting results
    console.log('\n3️⃣ Checking sorting results...');
    const { data: sortingResults, error: resultsError } = await supabase
      .from('sorting_results')
      .select(`
        id,
        size_class,
        total_pieces,
        total_weight_grams,
        storage_location_id,
        sorting_batch_id,
        sorting_batch:sorting_batches(
          id,
          batch_number,
          status,
          created_at
        )
      `)
      .order('created_at', { ascending: false });
    
    if (resultsError) {
      console.log('❌ Error fetching sorting results:', resultsError);
    } else {
      console.log('✅ Sorting results found:', sortingResults?.length || 0);
      
      // Analyze the data
      const withStorageLocation = sortingResults?.filter(r => r.storage_location_id) || [];
      const withoutStorageLocation = sortingResults?.filter(r => !r.storage_location_id) || [];
      const completedBatches = sortingResults?.filter(r => r.sorting_batch?.status === 'completed') || [];
      const withWeight = sortingResults?.filter(r => r.total_weight_grams > 0) || [];
      
      console.log(`  - With storage_location_id: ${withStorageLocation.length}`);
      console.log(`  - Without storage_location_id: ${withoutStorageLocation.length}`);
      console.log(`  - From completed batches: ${completedBatches.length}`);
      console.log(`  - With weight > 0: ${withWeight.length}`);
      
      // Show sample data
      if (sortingResults && sortingResults.length > 0) {
        console.log('\n📊 Sample sorting results:');
        sortingResults.slice(0, 3).forEach(result => {
          console.log(`  - Size ${result.size_class}: ${result.total_pieces} pieces (${result.total_weight_grams}g) - Storage: ${result.storage_location_id ? 'Yes' : 'No'} - Batch: ${result.sorting_batch?.status || 'Unknown'}`);
        });
      }
    }
    
    // 4. Check the specific query used by inventory service
    console.log('\n4️⃣ Testing inventory service query...');
    const { data: inventoryQuery, error: inventoryError } = await supabase
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
      .gt('total_weight_grams', 0)
      .order('created_at', { ascending: false });
    
    if (inventoryError) {
      console.log('❌ Error with inventory query:', inventoryError);
    } else {
      console.log('✅ Inventory query results:', inventoryQuery?.length || 0);
      
      if (inventoryQuery && inventoryQuery.length > 0) {
        console.log('\n📦 Sample inventory items:');
        inventoryQuery.slice(0, 3).forEach(item => {
          console.log(`  - Size ${item.size_class}: ${item.total_pieces} pieces (${item.total_weight_grams}g)`);
          console.log(`    Storage: ${item.storage_location_id}`);
          console.log(`    Batch: ${item.sorting_batch?.batch_number} (${item.sorting_batch?.status})`);
          console.log(`    Farmer: ${item.sorting_batch?.processing_record?.warehouse_entry?.farmers?.name || 'Unknown'}`);
        });
      }
    }
    
    // 5. Check if there are any completed batches with sorting results
    console.log('\n5️⃣ Checking completed batches with results...');
    const { data: completedBatches, error: completedError } = await supabase
      .from('sorting_batches')
      .select(`
        id,
        batch_number,
        status,
        created_at,
        sorting_results(
          id,
          size_class,
          total_pieces,
          total_weight_grams,
          storage_location_id
        )
      `)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });
    
    if (completedError) {
      console.log('❌ Error fetching completed batches:', completedError);
    } else {
      console.log('✅ Completed batches found:', completedBatches?.length || 0);
      
      completedBatches?.forEach(batch => {
        const results = batch.sorting_results || [];
        const withStorage = results.filter(r => r.storage_location_id);
        console.log(`  - ${batch.batch_number}: ${results.length} results, ${withStorage.length} with storage location`);
      });
    }
    
    // 6. Summary and recommendations
    console.log('\n📋 SUMMARY AND RECOMMENDATIONS:');
    console.log('='.repeat(50));
    
    if (!storageLocations || storageLocations.length === 0) {
      console.log('❌ No storage locations found - this will prevent inventory display');
      console.log('🔧 Create storage locations in the database');
    }
    
    if (!sortingBatches || sortingBatches.length === 0) {
      console.log('❌ No sorting batches found - create some sorting batches first');
    }
    
    if (!sortingResults || sortingResults.length === 0) {
      console.log('❌ No sorting results found - complete some sorting operations');
    }
    
    const inventoryItems = inventoryQuery || [];
    if (inventoryItems.length === 0) {
      console.log('❌ No inventory items found - this is why records are not showing');
      console.log('🔧 Possible issues:');
      console.log('   - Sorting results missing storage_location_id');
      console.log('   - Sorting results have total_weight_grams = 0');
      console.log('   - Sorting batches not marked as completed');
    } else {
      console.log(`✅ Found ${inventoryItems.length} inventory items - records should be showing`);
    }
    
  } catch (error) {
    console.log('❌ Exception during debugging:', error);
  }
}

async function runDebug() {
  console.log('🚀 Starting inventory display debugging...\n');
  await debugInventoryDisplay();
  console.log('\n🏁 Debugging complete!');
}

runDebug().catch(console.error);
