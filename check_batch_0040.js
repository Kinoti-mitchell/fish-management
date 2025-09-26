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

async function checkBatch0040() {
  console.log('🔍 Checking Batch 0040 Sorting Results and Inventory Updates\n');

  try {
    // 1. Check if batch 0040 exists in sorting_batches
    console.log('=== BATCH 0040 IN SORTING_BATCHES ===');
    const { data: sortingBatches, error: batchError } = await supabase
      .from('sorting_batches')
      .select('*')
      .eq('batch_number', '0040')
      .order('created_at', { ascending: false });

    if (batchError) {
      console.error('❌ Error fetching sorting batches:', batchError);
    } else {
      console.log(`Found ${sortingBatches?.length || 0} sorting batches for batch 0040`);
      if (sortingBatches && sortingBatches.length > 0) {
        console.log('Batch details:', sortingBatches[0]);
      }
    }

    // 2. Check sorting results for batch 0040
    console.log('\n=== SORTING RESULTS FOR BATCH 0040 ===');
    const { data: sortingResults, error: resultsError } = await supabase
      .from('sorting_results')
      .select(`
        *,
        sorting_batches!inner(batch_number),
        storage_locations(name)
      `)
      .eq('sorting_batches.batch_number', '0040')
      .order('size_class');

    if (resultsError) {
      console.error('❌ Error fetching sorting results:', resultsError);
    } else {
      console.log(`Found ${sortingResults?.length || 0} sorting results for batch 0040`);
      if (sortingResults && sortingResults.length > 0) {
        sortingResults.forEach(result => {
          const weightKg = (result.total_weight_grams || 0) / 1000;
          const recordStatus = result.updated_at > result.created_at ? 'UPDATED' : 'ORIGINAL';
          console.log(`Size ${result.size_class}: ${result.total_pieces} pieces, ${weightKg.toFixed(2)} kg, ${result.storage_locations?.name || 'Unknown storage'}, Status: ${recordStatus}`);
        });
      }
    }

    // 3. Check inventory entries for batch 0040
    console.log('\n=== INVENTORY ENTRIES FOR BATCH 0040 ===');
    if (sortingBatches && sortingBatches.length > 0) {
      const batchIds = sortingBatches.map(b => b.id);
      const { data: inventoryEntries, error: entriesError } = await supabase
        .from('inventory_entries')
        .select('*')
        .in('reference_id', batchIds)
        .order('size');

      if (entriesError) {
        console.error('❌ Error fetching inventory entries:', entriesError);
      } else {
        console.log(`Found ${inventoryEntries?.length || 0} inventory entries for batch 0040`);
        if (inventoryEntries && inventoryEntries.length > 0) {
          inventoryEntries.forEach(entry => {
            console.log(`Size ${entry.size}: ${entry.quantity} pieces, Type: ${entry.entry_type}, Notes: ${entry.notes || 'None'}`);
          });
        }
      }
    }

    // 4. Check current inventory levels by size (from sorting_results)
    console.log('\n=== CURRENT INVENTORY BY SIZE (FROM SORTING RESULTS) ===');
    if (sortingResults && sortingResults.length > 0) {
      const sizeSummary = {};
      sortingResults.forEach(result => {
        const size = result.size_class;
        if (!sizeSummary[size]) {
          sizeSummary[size] = {
            storage_locations: 0,
            total_pieces: 0,
            total_weight_grams: 0
          };
        }
        sizeSummary[size].storage_locations++;
        sizeSummary[size].total_pieces += result.total_pieces || 0;
        sizeSummary[size].total_weight_grams += result.total_weight_grams || 0;
      });

      Object.keys(sizeSummary).sort().forEach(size => {
        const summary = sizeSummary[size];
        const weightKg = summary.total_weight_grams / 1000;
        console.log(`Size ${size}: ${summary.storage_locations} locations, ${summary.total_pieces} pieces, ${weightKg.toFixed(2)} kg`);
      });
    }

    // 5. Check transfers involving batch 0040
    console.log('\n=== TRANSFERS INVOLVING BATCH 0040 ===');
    const { data: transfers, error: transfersError } = await supabase
      .from('transfers')
      .select('*')
      .eq('batch_number', '0040')
      .order('created_at', { ascending: false });

    if (transfersError) {
      console.error('❌ Error fetching transfers:', transfersError);
    } else {
      console.log(`Found ${transfers?.length || 0} transfers for batch 0040`);
      if (transfers && transfers.length > 0) {
        transfers.forEach(transfer => {
          console.log(`Transfer ${transfer.id}: Size ${transfer.size_class}, ${transfer.quantity} pieces, ${transfer.weight_kg} kg, Status: ${transfer.status}`);
        });
      }
    }

    // 6. Check inventory movement for batch 0040
    console.log('\n=== INVENTORY MOVEMENT FOR BATCH 0040 ===');
    if (transfers && transfers.length > 0) {
      const transferIds = transfers.map(t => t.id);
      const { data: movements, error: movementsError } = await supabase
        .from('inventory_movement')
        .select('*')
        .in('transfer_id', transferIds)
        .order('created_at', { ascending: false });

      if (movementsError) {
        console.error('❌ Error fetching inventory movements:', movementsError);
      } else {
        console.log(`Found ${movements?.length || 0} inventory movements for batch 0040`);
        if (movements && movements.length > 0) {
          movements.forEach(movement => {
            console.log(`Movement: Size ${movement.size_class}, ${movement.quantity_moved} pieces, ${movement.weight_moved_kg} kg`);
          });
        }
      }
    }

    // 7. Summary
    console.log('\n=== BATCH 0040 SUMMARY ===');
    const hasBatch = sortingBatches && sortingBatches.length > 0;
    const hasResults = sortingResults && sortingResults.length > 0;
    const hasEntries = sortingBatches && sortingBatches.length > 0 && 
      await supabase.from('inventory_entries').select('id').in('reference_id', sortingBatches.map(b => b.id)).then(({ data }) => data && data.length > 0);
    const hasTransfers = transfers && transfers.length > 0;

    console.log(`Batch 0040 Status: ${hasBatch ? 'EXISTS' : 'NOT FOUND'}`);
    console.log(`Sorting Results Count: ${sortingResults?.length || 0}`);
    console.log(`Total Pieces: ${sortingResults?.reduce((sum, r) => sum + (r.total_pieces || 0), 0) || 0}`);
    console.log(`Total Weight (kg): ${((sortingResults?.reduce((sum, r) => sum + (r.total_weight_grams || 0), 0) || 0) / 1000).toFixed(2)}`);
    console.log(`Has Inventory Entries: ${hasEntries ? 'YES' : 'NO'}`);
    console.log(`Has Transfers: ${hasTransfers ? 'YES' : 'NO'}`);

    // 8. Check for recent updates
    console.log('\n=== RECENT UPDATES TO BATCH 0040 SORTING RESULTS ===');
    if (sortingResults && sortingResults.length > 0) {
      sortingResults.forEach(result => {
        const weightKg = (result.total_weight_grams || 0) / 1000;
        const secondsSinceCreation = Math.floor((new Date(result.updated_at) - new Date(result.created_at)) / 1000);
        const updateStatus = result.updated_at > result.created_at ? 'HAS BEEN UPDATED' : 'NO UPDATES';
        console.log(`Size ${result.size_class}: ${result.total_pieces} pieces, ${weightKg.toFixed(2)} kg, ${secondsSinceCreation}s since creation, ${updateStatus}`);
      });
    }

    console.log('\n✅ Batch 0040 check completed!');

  } catch (error) {
    console.error('❌ Error during batch 0040 check:', error);
  }
}

checkBatch0040();
