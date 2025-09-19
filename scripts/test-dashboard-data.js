// Script to test dashboard data calculation with existing data
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

async function testDashboardData() {
  try {
    console.log('🧪 Testing dashboard data calculation with existing data...\n');

    // Test warehouse stats (temperature and weight)
    console.log('📦 WAREHOUSE STATS:');
    const { data: warehouseEntries } = await supabase
      .from('warehouse_entries')
      .select('total_weight, temperature, total_pieces, entry_date')
      .order('entry_date', { ascending: false });

    if (warehouseEntries && warehouseEntries.length > 0) {
      const totalWeight = warehouseEntries.reduce((sum, entry) => sum + (entry.total_weight || 0), 0);
      const totalPieces = warehouseEntries.reduce((sum, entry) => sum + (entry.total_pieces || 0), 0);
      
      // Temperature calculation (only from entries with temperature data)
      const entriesWithTemp = warehouseEntries.filter(entry => 
        entry.temperature !== null && entry.temperature !== undefined
      );
      
      const avgTemperature = entriesWithTemp.length > 0 
        ? entriesWithTemp.reduce((sum, entry) => sum + entry.temperature, 0) / entriesWithTemp.length
        : 22.0;
      
      // Fish size calculation
      const avgFishSize = totalPieces > 0 ? totalWeight / totalPieces : 0.5;
      
      console.log(`   Total entries: ${warehouseEntries.length}`);
      console.log(`   Entries with temperature: ${entriesWithTemp.length}`);
      console.log(`   Total weight: ${totalWeight}kg`);
      console.log(`   Total pieces: ${totalPieces}`);
      console.log(`   Average temperature: ${avgTemperature.toFixed(1)}°C`);
      console.log(`   Average fish size: ${avgFishSize.toFixed(2)}kg`);
      
      if (entriesWithTemp.length > 0) {
        console.log('\n   Temperature breakdown:');
        entriesWithTemp.forEach((entry, i) => {
          console.log(`   ${i+1}. ${entry.temperature}°C - ${entry.total_weight}kg`);
        });
      }
    }

    // Test processing stats (ready for dispatch)
    console.log('\n🏭 PROCESSING STATS:');
    const { data: processingRecords } = await supabase
      .from('processing_records')
      .select('ready_for_dispatch_count')
      .not('ready_for_dispatch_count', 'is', null);

    if (processingRecords && processingRecords.length > 0) {
      const totalReadyForDispatch = processingRecords.reduce((sum, record) => 
        sum + (record.ready_for_dispatch_count || 0), 0);
      
      console.log(`   Processing records with dispatch data: ${processingRecords.length}`);
      console.log(`   Total pieces ready for dispatch: ${totalReadyForDispatch}`);
    }

    // Test dispatch stats (pending)
    console.log('\n🚚 DISPATCH STATS:');
    const { data: dispatchRecords } = await supabase
      .from('dispatch_records')
      .select('status, total_weight');

    if (dispatchRecords && dispatchRecords.length > 0) {
      const pendingDispatches = dispatchRecords.filter(dispatch => 
        ['scheduled', 'pending'].includes(dispatch.status)
      );
      
      const totalDispatchedWeight = dispatchRecords.reduce((sum, dispatch) => 
        sum + (dispatch.total_weight || 0), 0);
      
      console.log(`   Total dispatch records: ${dispatchRecords.length}`);
      console.log(`   Pending dispatches: ${pendingDispatches.length}`);
      console.log(`   Total dispatched weight: ${totalDispatchedWeight}kg`);
      
      // Show status breakdown
      const statusCounts = dispatchRecords.reduce((acc, dispatch) => {
        acc[dispatch.status] = (acc[dispatch.status] || 0) + 1;
        return acc;
      }, {});
      
      console.log('   Status breakdown:', statusCounts);
    }

    // Test outlet orders
    console.log('\n🏪 OUTLET ORDER STATS:');
    const { data: outletOrders } = await supabase
      .from('outlet_orders')
      .select('status, total_value');

    if (outletOrders && outletOrders.length > 0) {
      const pendingOrders = outletOrders.filter(order => 
        ['pending', 'confirmed'].includes(order.status)
      );
      
      const totalOrderValue = outletOrders.reduce((sum, order) => 
        sum + (order.total_value || 0), 0);
      
      console.log(`   Total outlet orders: ${outletOrders.length}`);
      console.log(`   Pending orders: ${pendingOrders.length}`);
      console.log(`   Total order value: KES ${totalOrderValue.toLocaleString()}`);
    }

    console.log('\n✅ Dashboard data test completed!');
    console.log('\n📊 SUMMARY FOR DASHBOARD:');
    console.log(`   Temperature: ${avgTemperature?.toFixed(1) || 'N/A'}°C (from ${entriesWithTemp?.length || 0} entries)`);
    console.log(`   Fish Size: ${avgFishSize?.toFixed(2) || 'N/A'}kg (from ${totalPieces || 0} pieces)`);
    console.log(`   Pending Dispatches: ${pendingDispatches?.length || 0}`);
    console.log(`   Ready for Dispatch: ${totalReadyForDispatch || 0} pieces`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
testDashboardData();
