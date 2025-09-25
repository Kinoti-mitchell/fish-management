// Script to check inventory data and see why it's showing 0
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

async function checkInventoryData() {
  try {
    console.log('🔍 Checking inventory data...\n');

    // Check fish_inventory table
    console.log('🐟 FISH INVENTORY TABLE:');
    const { data: fishInventory, error: fiError } = await supabase
      .from('fish_inventory')
      .select('*')
      .order('created_at', { ascending: false });

    if (fiError) {
      console.error('❌ Error fetching fish inventory:', fiError);
    } else {
      console.log(`   Total fish inventory records: ${fishInventory?.length || 0}`);
      
      if (fishInventory && fishInventory.length > 0) {
        const totalWeight = fishInventory.reduce((sum, f) => sum + (f.weight || 0), 0);
        console.log(`   Total inventory weight: ${totalWeight}kg`);
        
        console.log('\n   Sample inventory records:');
        fishInventory.slice(0, 3).forEach((item, i) => {
          console.log(`   ${i+1}. Size: ${item.size}, Weight: ${item.weight}kg, Grade: ${item.grade || 'N/A'}`);
        });
      } else {
        console.log('   ⚠️  No fish inventory records found!');
      }
    }

    // Check inventory_entries table (alternative inventory table)
    console.log('\n📦 INVENTORY ENTRIES TABLE:');
    const { data: inventoryEntries, error: ieError } = await supabase
      .from('inventory_entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (ieError) {
      console.error('❌ Error fetching inventory entries:', ieError);
    } else {
      console.log(`   Total inventory entries: ${inventoryEntries?.length || 0}`);
      
      if (inventoryEntries && inventoryEntries.length > 0) {
        const totalWeight = inventoryEntries.reduce((sum, f) => sum + (f.total_weight || f.weight || 0), 0);
        console.log(`   Total inventory weight: ${totalWeight}kg`);
        
        console.log('\n   Sample inventory entries:');
        inventoryEntries.slice(0, 3).forEach((item, i) => {
          console.log(`   ${i+1}. Type: ${item.entry_type}, Weight: ${item.total_weight || item.weight}kg, Fish: ${item.fish_type || 'N/A'}`);
        });
      } else {
        console.log('   ⚠️  No inventory entries found!');
      }
    }

    // Check what the dashboard service is actually querying
    console.log('\n🔍 DASHBOARD SERVICE INVENTORY QUERY:');
    
    // This is what the dashboard service queries
    const { data: dashboardInventory, error: dashError } = await supabase
      .from('fish_inventory')
      .select('weight, total_weight, grade')
      .not('weight', 'is', null);

    if (dashError) {
      console.error('❌ Error in dashboard inventory query:', dashError);
    } else {
      console.log(`   Dashboard query result: ${dashboardInventory?.length || 0} records`);
      
      if (dashboardInventory && dashboardInventory.length > 0) {
        const totalWeight = dashboardInventory.reduce((sum, item) => sum + (item.weight || item.total_weight || 0), 0);
        console.log(`   Total weight from dashboard query: ${totalWeight}kg`);
      }
    }

    // Check if we should use warehouse_entries as inventory instead
    console.log('\n🏭 WAREHOUSE ENTRIES AS INVENTORY:');
    const { data: warehouseAsInventory } = await supabase
      .from('warehouse_entries')
      .select('total_weight, fish_type, condition')
      .not('total_weight', 'is', null);

    if (warehouseAsInventory && warehouseAsInventory.length > 0) {
      const totalWeight = warehouseAsInventory.reduce((sum, entry) => sum + (entry.total_weight || 0), 0);
      console.log(`   Using warehouse entries as inventory: ${warehouseAsInventory.length} records`);
      console.log(`   Total weight: ${totalWeight}kg`);
    }

    console.log('\n✅ Inventory data check completed!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
checkInventoryData();
