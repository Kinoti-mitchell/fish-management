// Script to test dashboard with weight-focused data (no pieces)
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

async function testDashboardWeights() {
  try {
    console.log('⚖️ Testing dashboard with weight-focused data...\n');

    // Test inventory data - focus on weights
    console.log('📦 INVENTORY DATA (Weight-focused):');
    const { data: inventoryData } = await supabase
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

    const totalInventoryWeight = inventoryData?.reduce((sum, item) => sum + (item.total_weight_grams || 0), 0) / 1000 || 0;
    const totalInventoryPieces = inventoryData?.reduce((sum, item) => sum + (item.total_pieces || 0), 0) || 0;
    const avgFishSize = totalInventoryPieces > 0 ? totalInventoryWeight / totalInventoryPieces : 0.5;

    console.log(`   Total Inventory Weight: ${totalInventoryWeight.toFixed(2)}kg`);
    console.log(`   Inventory Items (weight-based): ${Math.round(totalInventoryWeight)}kg`);
    console.log(`   Average Fish Size: ${avgFishSize.toFixed(2)}kg`);
    console.log(`   (Total pieces: ${totalInventoryPieces} - but we focus on weight)`);

    // Test processing data - focus on weights
    console.log('\n⚙️ PROCESSING DATA (Weight-focused):');
    const { data: processingRecords } = await supabase
      .from('processing_records')
      .select('ready_for_dispatch_count, post_processing_weight, processing_date')
      .order('processing_date', { ascending: false });

    const totalProcessedWeight = processingRecords?.reduce((sum, record) => sum + (record.post_processing_weight || 0), 0) || 0;
    const totalReadyForDispatchPieces = processingRecords?.reduce((sum, record) => sum + (record.ready_for_dispatch_count || 0), 0) || 0;

    console.log(`   Total Processed Weight: ${totalProcessedWeight.toFixed(2)}kg`);
    console.log(`   Ready for Dispatch (weight-based): ${Math.round(totalProcessedWeight)}kg`);
    console.log(`   (Ready pieces: ${totalReadyForDispatchPieces} - but we focus on weight)`);

    // Test warehouse data - focus on weights
    console.log('\n🏭 WAREHOUSE DATA (Weight-focused):');
    const { data: warehouseEntries } = await supabase
      .from('warehouse_entries')
      .select('total_weight, temperature, entry_date, total_pieces')
      .order('entry_date', { ascending: false });

    const totalWarehouseWeight = warehouseEntries?.reduce((sum, entry) => sum + (entry.total_weight || 0), 0) || 0;
    const totalWarehousePieces = warehouseEntries?.reduce((sum, entry) => sum + (entry.total_pieces || 0), 0) || 0;
    
    const entriesWithTemp = warehouseEntries?.filter(entry => entry.temperature !== null && entry.temperature !== undefined) || [];
    const avgTemperature = entriesWithTemp.length > 0 
      ? entriesWithTemp.reduce((sum, entry) => sum + entry.temperature, 0) / entriesWithTemp.length
      : 22.0;

    console.log(`   Total Warehouse Weight: ${totalWarehouseWeight.toFixed(2)}kg`);
    console.log(`   Average Temperature: ${avgTemperature.toFixed(1)}°C`);
    console.log(`   (Total pieces: ${totalWarehousePieces} - but we focus on weight)`);

    // Test dispatch data - focus on weights
    console.log('\n🚚 DISPATCH DATA (Weight-focused):');
    const { data: confirmedOrdersForDispatch } = await supabase
      .from('outlet_orders')
      .select('id, status, total_value, order_date')
      .eq('status', 'confirmed')
      .order('order_date', { ascending: false });

    const { data: dispatchRecords } = await supabase
      .from('dispatch_records')
      .select('total_weight, status')
      .order('dispatch_date', { ascending: false });

    const pendingDispatches = confirmedOrdersForDispatch?.length || 0;
    const totalDispatchedWeight = dispatchRecords?.reduce((sum, dispatch) => sum + (dispatch.total_weight || 0), 0) || 0;

    console.log(`   Pending Dispatches: ${pendingDispatches} (confirmed orders ready for dispatch)`);
    console.log(`   Total Dispatched Weight: ${totalDispatchedWeight.toFixed(2)}kg`);

    console.log('\n✅ DASHBOARD WEIGHT-FOCUSED TEST COMPLETED!');
    console.log('\n📊 EXPECTED DASHBOARD VALUES (Weight-focused):');
    console.log(`   Inventory Items: ${Math.round(totalInventoryWeight)}kg (weight-based, not pieces)`);
    console.log(`   Average Fish Size: ${avgFishSize.toFixed(2)}kg`);
    console.log(`   Average Temperature: ${avgTemperature.toFixed(1)}°C`);
    console.log(`   Pending Dispatches: ${pendingDispatches} (confirmed orders)`);
    console.log(`   Ready for Dispatch: ${Math.round(totalProcessedWeight)}kg (weight-based, not pieces)`);
    console.log(`   Total Warehouse Weight: ${totalWarehouseWeight.toFixed(2)}kg`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
testDashboardWeights();
