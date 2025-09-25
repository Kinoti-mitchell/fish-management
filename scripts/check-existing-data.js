// Script to check existing data in the database and calculate dashboard metrics
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

async function checkExistingData() {
  try {
    console.log('🔍 Checking existing data in the database...\n');

    // Check warehouse entries
    console.log('📦 WAREHOUSE ENTRIES:');
    const { data: warehouseEntries, error: weError } = await supabase
      .from('warehouse_entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (weError) {
      console.error('❌ Error fetching warehouse entries:', weError);
    } else {
      console.log(`   Total entries: ${warehouseEntries?.length || 0}`);
      
      if (warehouseEntries && warehouseEntries.length > 0) {
        const withTemp = warehouseEntries.filter(e => e.temperature !== null && e.temperature !== undefined);
        const withWeight = warehouseEntries.filter(e => e.total_weight && e.total_weight > 0);
        const withPieces = warehouseEntries.filter(e => e.total_pieces && e.total_pieces > 0);
        
        console.log(`   With temperature data: ${withTemp.length}`);
        console.log(`   With weight data: ${withWeight.length}`);
        console.log(`   With pieces data: ${withPieces.length}`);
        
        if (withTemp.length > 0) {
          const avgTemp = withTemp.reduce((sum, e) => sum + e.temperature, 0) / withTemp.length;
          console.log(`   Average temperature: ${avgTemp.toFixed(1)}°C`);
        }
        
        if (withWeight.length > 0 && withPieces.length > 0) {
          const totalWeight = withWeight.reduce((sum, e) => sum + e.total_weight, 0);
          const totalPieces = withPieces.reduce((sum, e) => sum + e.total_pieces, 0);
          const avgFishSize = totalPieces > 0 ? totalWeight / totalPieces : 0;
          console.log(`   Total weight: ${totalWeight}kg`);
          console.log(`   Total pieces: ${totalPieces}`);
          console.log(`   Average fish size: ${avgFishSize.toFixed(2)}kg`);
        }
        
        // Show sample entries
        console.log('\n   Sample entries:');
        warehouseEntries.slice(0, 3).forEach((entry, i) => {
          console.log(`   ${i+1}. ${entry.fish_type || 'Unknown'} - ${entry.total_weight || 0}kg, ${entry.total_pieces || 0} pieces, ${entry.temperature || 'No temp'}°C`);
        });
      }
    }

    // Check processing records
    console.log('\n🏭 PROCESSING RECORDS:');
    const { data: processingRecords, error: prError } = await supabase
      .from('processing_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (prError) {
      console.error('❌ Error fetching processing records:', prError);
    } else {
      console.log(`   Total processing records: ${processingRecords?.length || 0}`);
      
      if (processingRecords && processingRecords.length > 0) {
        const readyForDispatch = processingRecords.filter(p => p.ready_for_dispatch_count && p.ready_for_dispatch_count > 0);
        console.log(`   Ready for dispatch: ${readyForDispatch.length}`);
        
        if (readyForDispatch.length > 0) {
          const totalReady = readyForDispatch.reduce((sum, p) => sum + (p.ready_for_dispatch_count || 0), 0);
          console.log(`   Total pieces ready: ${totalReady}`);
        }
      }
    }

    // Check dispatch records
    console.log('\n🚚 DISPATCH RECORDS:');
    const { data: dispatchRecords, error: drError } = await supabase
      .from('dispatch_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (drError) {
      console.error('❌ Error fetching dispatch records:', drError);
    } else {
      console.log(`   Total dispatch records: ${dispatchRecords?.length || 0}`);
      
      if (dispatchRecords && dispatchRecords.length > 0) {
        const pending = dispatchRecords.filter(d => d.status === 'pending' || d.status === 'scheduled');
        const completed = dispatchRecords.filter(d => d.status === 'completed');
        const inTransit = dispatchRecords.filter(d => d.status === 'in_transit');
        
        console.log(`   Pending: ${pending.length}`);
        console.log(`   In transit: ${inTransit.length}`);
        console.log(`   Completed: ${completed.length}`);
        
        if (pending.length > 0) {
          console.log('\n   Pending dispatches:');
          pending.slice(0, 3).forEach((dispatch, i) => {
            console.log(`   ${i+1}. ${dispatch.destination || 'Unknown'} - ${dispatch.status} - ${dispatch.total_weight || 0}kg`);
          });
        }
      }
    }

    // Check fish inventory
    console.log('\n🐟 FISH INVENTORY:');
    const { data: fishInventory, error: fiError } = await supabase
      .from('fish_inventory')
      .select('*')
      .order('created_at', { ascending: false });

    if (fiError) {
      console.error('❌ Error fetching fish inventory:', fiError);
    } else {
      console.log(`   Total inventory records: ${fishInventory?.length || 0}`);
      
      if (fishInventory && fishInventory.length > 0) {
        const totalWeight = fishInventory.reduce((sum, f) => sum + (f.weight || 0), 0);
        console.log(`   Total inventory weight: ${totalWeight}kg`);
      }
    }

    // Check outlet orders
    console.log('\n🏪 OUTLET ORDERS:');
    const { data: outletOrders, error: ooError } = await supabase
      .from('outlet_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (ooError) {
      console.error('❌ Error fetching outlet orders:', ooError);
    } else {
      console.log(`   Total outlet orders: ${outletOrders?.length || 0}`);
      
      if (outletOrders && outletOrders.length > 0) {
        const pending = outletOrders.filter(o => o.status === 'pending' || o.status === 'confirmed');
        const completed = outletOrders.filter(o => o.status === 'completed');
        
        console.log(`   Pending: ${pending.length}`);
        console.log(`   Completed: ${completed.length}`);
      }
    }

    // Check farmers
    console.log('\n👨‍🌾 FARMERS:');
    const { data: farmers, error: fError } = await supabase
      .from('farmers')
      .select('*')
      .order('created_at', { ascending: false });

    if (fError) {
      console.error('❌ Error fetching farmers:', fError);
    } else {
      console.log(`   Total farmers: ${farmers?.length || 0}`);
    }

    console.log('\n✅ Data check completed!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
checkExistingData();
