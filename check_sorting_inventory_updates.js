const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/server.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkSortingInventoryUpdates() {
  console.log('🔍 Checking if inventory is getting updated after sorting\n');

  try {
    // 1. Check recent sorting batches and their status
    console.log('=== RECENT SORTING BATCHES ===');
    const { data: sortingBatches, error: batchError } = await supabase
      .from('sorting_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (batchError) {
      console.error('❌ Error fetching sorting batches:', batchError);
    } else {
      console.log(`Found ${sortingBatches?.length || 0} recent sorting batches`);
      if (sortingBatches && sortingBatches.length > 0) {
        sortingBatches.forEach(batch => {
          const weightKg = (batch.total_weight_kg || 0);
          console.log(`Batch ${batch.batch_number}: Status=${batch.status}, Weight=${weightKg}kg, Created=${batch.created_at}, Updated=${batch.updated_at}`);
        });
      }
    }

    // 2. Check sorting results (which ARE the inventory)
    console.log('\n=== SORTING RESULTS (INVENTORY) ===');
    const { data: sortingResults, error: resultsError } = await supabase
      .from('sorting_results')
      .select(`
        *,
        sorting_batches!inner(batch_number, status, created_at),
        storage_locations!sorting_results_storage_location_id_fkey(name, location_type)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (resultsError) {
      console.error('❌ Error fetching sorting results:', resultsError);
    } else {
      console.log(`Found ${sortingResults?.length || 0} sorting results (inventory items)`);
      if (sortingResults && sortingResults.length > 0) {
        sortingResults.forEach(result => {
          const weightKg = (result.total_weight_grams || 0) / 1000;
          const recordStatus = result.updated_at > result.created_at ? 'UPDATED' : 'ORIGINAL';
          console.log(`Size ${result.size_class}: ${result.total_pieces} pieces, ${weightKg.toFixed(2)} kg, ${result.storage_locations?.name || 'Unknown'}, Batch: ${result.sorting_batches?.batch_number}, Status: ${recordStatus}`);
        });
      }
    }

    // 3. Check inventory entries (tracking table)
    console.log('\n=== INVENTORY ENTRIES (TRACKING) ===');
    const { data: inventoryEntries, error: entriesError } = await supabase
      .from('inventory_entries')
      .select('*')
      .eq('entry_type', 'sorting')
      .order('created_at', { ascending: false })
      .limit(10);

    if (entriesError) {
      console.error('❌ Error fetching inventory entries:', entriesError);
    } else {
      console.log(`Found ${inventoryEntries?.length || 0} inventory entries from sorting`);
      if (inventoryEntries && inventoryEntries.length > 0) {
        inventoryEntries.forEach(entry => {
          console.log(`Size ${entry.size}: ${entry.quantity} pieces, Reference: ${entry.reference_id}, Notes: ${entry.notes || 'None'}`);
        });
      }
    }

    // 4. Check if sorting batches are being automatically added to inventory
    console.log('\n=== AUTOMATIC INVENTORY ADDITION CHECK ===');
    if (sortingBatches && sortingBatches.length > 0) {
      const completedBatches = sortingBatches.filter(b => b.status === 'completed');
      console.log(`Found ${completedBatches.length} completed sorting batches`);
      
      for (const batch of completedBatches) {
        // Check if this batch has inventory entries
        const { data: batchEntries, error: batchEntriesError } = await supabase
          .from('inventory_entries')
          .select('id')
          .eq('reference_id', batch.id)
          .eq('entry_type', 'sorting');

        if (batchEntriesError) {
          console.error(`❌ Error checking inventory entries for batch ${batch.batch_number}:`, batchEntriesError);
        } else {
          const hasInventoryEntries = batchEntries && batchEntries.length > 0;
          console.log(`Batch ${batch.batch_number}: ${hasInventoryEntries ? 'HAS' : 'MISSING'} inventory entries`);
        }
      }
    }

    // 5. Check storage location capacity updates
    console.log('\n=== STORAGE LOCATION CAPACITY UPDATES ===');
    const { data: storageLocations, error: storageError } = await supabase
      .from('storage_locations')
      .select('id, name, capacity_kg, current_usage_kg, updated_at')
      .order('updated_at', { ascending: false })
      .limit(10);

    if (storageError) {
      console.error('❌ Error fetching storage locations:', storageError);
    } else {
      console.log(`Found ${storageLocations?.length || 0} storage locations`);
      if (storageLocations && storageLocations.length > 0) {
        storageLocations.forEach(storage => {
          const utilization = storage.capacity_kg > 0 ? ((storage.current_usage_kg || 0) / storage.capacity_kg * 100).toFixed(1) : '0';
          console.log(`${storage.name}: ${storage.current_usage_kg || 0}kg / ${storage.capacity_kg || 0}kg (${utilization}%), Updated: ${storage.updated_at}`);
        });
      }
    }

    // 6. Check for any sorting batches that might not have been added to inventory
    console.log('\n=== MISSING INVENTORY ADDITIONS ===');
    if (sortingBatches && sortingBatches.length > 0) {
      const completedBatches = sortingBatches.filter(b => b.status === 'completed');
      const missingInventory = [];

      for (const batch of completedBatches) {
        const { data: entries } = await supabase
          .from('inventory_entries')
          .select('id')
          .eq('reference_id', batch.id)
          .eq('entry_type', 'sorting');

        if (!entries || entries.length === 0) {
          missingInventory.push(batch);
        }
      }

      if (missingInventory.length > 0) {
        console.log(`Found ${missingInventory.length} completed batches missing inventory entries:`);
        missingInventory.forEach(batch => {
          console.log(`- Batch ${batch.batch_number} (${batch.id}): Completed ${batch.updated_at}, Weight: ${batch.total_weight_kg}kg`);
        });
      } else {
        console.log('✅ All completed sorting batches have inventory entries');
      }
    }

    // 7. Summary
    console.log('\n=== SUMMARY ===');
    const totalBatches = sortingBatches?.length || 0;
    const completedBatches = sortingBatches?.filter(b => b.status === 'completed').length || 0;
    const totalInventoryItems = sortingResults?.length || 0;
    const totalInventoryEntries = inventoryEntries?.length || 0;
    const totalWeight = sortingResults?.reduce((sum, r) => sum + (r.total_weight_grams || 0), 0) / 1000 || 0;

    console.log(`Total Sorting Batches: ${totalBatches}`);
    console.log(`Completed Batches: ${completedBatches}`);
    console.log(`Inventory Items (sorting_results): ${totalInventoryItems}`);
    console.log(`Inventory Entries (tracking): ${totalInventoryEntries}`);
    console.log(`Total Inventory Weight: ${totalWeight.toFixed(2)} kg`);
    console.log(`Inventory Update Status: ${completedBatches > 0 && totalInventoryItems > 0 ? '✅ WORKING' : '❌ ISSUES DETECTED'}`);

    // 8. Check the add_stock_from_sorting function
    console.log('\n=== TESTING ADD_STOCK_FROM_SORTING FUNCTION ===');
    if (completedBatches > 0) {
      const testBatch = sortingBatches.find(b => b.status === 'completed');
      if (testBatch) {
        try {
          const { data: testResult, error: testError } = await supabase.rpc('add_stock_from_sorting', {
            p_sorting_batch_id: testBatch.id
          });

          if (testError) {
            console.log(`⚠️ Function test for batch ${testBatch.batch_number}: ${testError.message}`);
          } else {
            console.log(`✅ Function test for batch ${testBatch.batch_number}: SUCCESS`);
            if (testResult && testResult.length > 0) {
              console.log(`   Returned ${testResult.length} inventory items`);
            }
          }
        } catch (err) {
          console.log(`❌ Function test error for batch ${testBatch.batch_number}: ${err.message}`);
        }
      }
    }

    console.log('\n✅ Sorting inventory update check completed!');

  } catch (error) {
    console.error('❌ Error during sorting inventory update check:', error);
  }
}

checkSortingInventoryUpdates();
