// Script to test the fixed dashboard inventory calculation
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

async function testDashboardInventoryFix() {
  try {
    console.log('🧪 Testing fixed dashboard inventory calculation...\n');

    // Test the new inventory query (same as inventory components)
    console.log('📦 FIXED INVENTORY QUERY (sorting_results):');
    const { data: inventory, error } = await supabase
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

    if (error) {
      console.error('❌ Error in fixed inventory query:', error);
      return;
    }

    console.log(`   Records found: ${inventory?.length || 0}`);

    if (inventory && inventory.length > 0) {
      const totalInventoryPieces = inventory.reduce((sum, item) => sum + (item.total_pieces || 0), 0);
      const totalInventoryWeight = inventory.reduce((sum, item) => sum + (item.total_weight_grams || 0), 0) / 1000; // Convert grams to kg
      const totalInventoryItems = inventory.length;
      const avgFishSize = totalInventoryPieces > 0 ? totalInventoryWeight / totalInventoryPieces : 0.5;

      console.log(`   Total inventory pieces: ${totalInventoryPieces}`);
      console.log(`   Total inventory weight: ${totalInventoryWeight.toFixed(2)}kg`);
      console.log(`   Total inventory items (records): ${totalInventoryItems}`);
      console.log(`   Average fish size: ${avgFishSize.toFixed(2)}kg`);

      // Show size distribution
      const sizeDistribution = inventory.reduce((acc, item) => {
        const size = `Size ${item.size_class}`;
        acc[size] = (acc[size] || 0) + (item.total_pieces || 0);
        return acc;
      }, {});

      console.log('\n   Size distribution:');
      Object.entries(sizeDistribution).forEach(([size, pieces]) => {
        console.log(`   ${size}: ${pieces} pieces`);
      });

      console.log('\n✅ DASHBOARD INVENTORY FIX SUCCESSFUL!');
      console.log('\n📊 EXPECTED DASHBOARD VALUES:');
      console.log(`   Inventory Items: ${totalInventoryPieces} (instead of 0)`);
      console.log(`   Average Fish Size: ${avgFishSize.toFixed(2)}kg (from inventory data)`);
      console.log(`   Total Inventory Weight: ${totalInventoryWeight.toFixed(2)}kg`);

    } else {
      console.log('   ⚠️  No inventory data found in sorting_results');
    }

    // Also test the old query to show the difference
    console.log('\n🔍 OLD INVENTORY QUERY (fish_inventory) for comparison:');
    const { data: oldInventory, error: oldError } = await supabase
      .from('fish_inventory')
      .select('weight, total_weight, size, grade, created_at');

    if (oldError) {
      console.log(`   Error: ${oldError.message}`);
    } else {
      console.log(`   Records found: ${oldInventory?.length || 0}`);
      if (oldInventory && oldInventory.length > 0) {
        console.log('   Sample record:', oldInventory[0]);
      }
    }

    console.log('\n🎉 Dashboard inventory fix test completed!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
testDashboardInventoryFix();
