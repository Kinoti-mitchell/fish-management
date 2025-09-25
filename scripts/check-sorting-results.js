// Script to check sorting_results table which is used by inventory components
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from server.env
const envPath = path.join(__dirname, '..', 'server', 'server.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSortingResults() {
  try {
    console.log('🔍 Checking sorting_results table (used by inventory components)...\n');

    // Check sorting_results table
    console.log('📦 SORTING RESULTS TABLE:');
    const { data: sortingResults, error: srError } = await supabase
      .from('sorting_results')
      .select('*')
      .order('created_at', { ascending: false });

    if (srError) {
      console.error('❌ Error fetching sorting results:', srError);
    } else {
      console.log(`   Total sorting results: ${sortingResults?.length || 0}`);
      
      if (sortingResults && sortingResults.length > 0) {
        const totalPieces = sortingResults.reduce((sum, r) => sum + (r.total_pieces || 0), 0);
        const totalWeight = sortingResults.reduce((sum, r) => sum + (r.total_weight_grams || 0), 0) / 1000; // Convert to kg
        
        console.log(`   Total pieces: ${totalPieces}`);
        console.log(`   Total weight: ${totalWeight.toFixed(2)}kg`);
        
        // Group by size class
        const sizeGroups = sortingResults.reduce((acc, result) => {
          const size = result.size_class;
          if (!acc[size]) {
            acc[size] = { pieces: 0, weight: 0, count: 0 };
          }
          acc[size].pieces += result.total_pieces || 0;
          acc[size].weight += (result.total_weight_grams || 0) / 1000;
          acc[size].count += 1;
          return acc;
        }, {});
        
        console.log('\n   Size distribution:');
        Object.entries(sizeGroups).forEach(([size, data]) => {
          console.log(`   Size ${size}: ${data.pieces} pieces, ${data.weight.toFixed(2)}kg (${data.count} batches)`);
        });
        
        console.log('\n   Sample sorting results:');
        sortingResults.slice(0, 3).forEach((result, i) => {
          console.log(`   ${i+1}. Size ${result.size_class}: ${result.total_pieces} pieces, ${(result.total_weight_grams || 0) / 1000}kg`);
        });
      } else {
        console.log('   ⚠️  No sorting results found!');
      }
    }

    // Check sorting_batches table
    console.log('\n🏭 SORTING BATCHES TABLE:');
    const { data: sortingBatches, error: sbError } = await supabase
      .from('sorting_batches')
      .select('*')
      .order('created_at', { ascending: false });

    if (sbError) {
      console.error('❌ Error fetching sorting batches:', sbError);
    } else {
      console.log(`   Total sorting batches: ${sortingBatches?.length || 0}`);
      
      if (sortingBatches && sortingBatches.length > 0) {
        const completed = sortingBatches.filter(b => b.status === 'completed');
        const pending = sortingBatches.filter(b => b.status === 'pending');
        const inProgress = sortingBatches.filter(b => b.status === 'in_progress');
        
        console.log(`   Completed: ${completed.length}`);
        console.log(`   Pending: ${pending.length}`);
        console.log(`   In Progress: ${inProgress.length}`);
        
        if (completed.length > 0) {
          console.log('\n   Sample completed batches:');
          completed.slice(0, 3).forEach((batch, i) => {
            console.log(`   ${i+1}. Batch ${batch.batch_number || batch.id?.slice(-8)}: ${batch.status}`);
          });
        }
      } else {
        console.log('   ⚠️  No sorting batches found!');
      }
    }

    // Check what the dashboard service should be using for inventory
    console.log('\n🔍 DASHBOARD INVENTORY CALCULATION:');
    
    // This is what the inventory service actually queries
    const { data: inventoryData, error: invError } = await supabase
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
      .eq('sorting_batch.status', 'completed')
      .not('storage_location_id', 'is', null);

    if (invError) {
      console.error('❌ Error in dashboard inventory query:', invError);
    } else {
      console.log(`   Dashboard inventory query result: ${inventoryData?.length || 0} records`);
      
      if (inventoryData && inventoryData.length > 0) {
        const totalPieces = inventoryData.reduce((sum, item) => sum + (item.total_pieces || 0), 0);
        const totalWeight = inventoryData.reduce((sum, item) => sum + (item.total_weight_grams || 0), 0) / 1000;
        
        console.log(`   Total inventory pieces: ${totalPieces}`);
        console.log(`   Total inventory weight: ${totalWeight.toFixed(2)}kg`);
        
        // Calculate average fish size
        const avgFishSize = totalPieces > 0 ? totalWeight / totalPieces : 0;
        console.log(`   Average fish size: ${avgFishSize.toFixed(2)}kg`);
      }
    }

    console.log('\n✅ Sorting results check completed!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
checkSortingResults();
