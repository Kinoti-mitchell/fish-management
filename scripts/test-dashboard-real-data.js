// Script to test that dashboard now uses the same data as components
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

async function testDashboardRealData() {
  try {
    console.log('🧪 Testing dashboard with real component data...\n');

    // Test inventory data (same as InventoryManagement component)
    console.log('📦 INVENTORY DATA (InventoryManagement component):');
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

    const totalInventoryPieces = inventoryData?.reduce((sum, item) => sum + (item.total_pieces || 0), 0) || 0;
    const totalInventoryWeight = inventoryData?.reduce((sum, item) => sum + (item.total_weight_grams || 0), 0) / 1000 || 0;
    const avgFishSize = totalInventoryPieces > 0 ? totalInventoryWeight / totalInventoryPieces : 0.5;

    console.log(`   Inventory Items: ${totalInventoryPieces}`);
    console.log(`   Average Fish Size: ${avgFishSize.toFixed(2)}kg`);
    console.log(`   Total Weight: ${totalInventoryWeight.toFixed(2)}kg`);

    // Test order data (same as OrderManagement component)
    console.log('\n🏪 ORDER DATA (OrderManagement component):');
    const { data: orders } = await supabase
      .from('outlet_orders')
      .select('total_value, status, order_date, requested_quantity')
      .order('order_date', { ascending: false });

    const totalOrders = orders?.length || 0;
    const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
    const confirmedOrders = orders?.filter(o => o.status === 'confirmed').length || 0;
    const dispatchedOrders = orders?.filter(o => o.status === 'dispatched').length || 0;
    const totalOrderValue = orders?.reduce((sum, order) => sum + (order.total_value || 0), 0) || 0;

    console.log(`   Total Orders: ${totalOrders}`);
    console.log(`   Pending Orders: ${pendingOrders}`);
    console.log(`   Confirmed Orders: ${confirmedOrders}`);
    console.log(`   Dispatched Orders: ${dispatchedOrders}`);
    console.log(`   Total Order Value: KES ${totalOrderValue.toLocaleString()}`);

    // Test dispatch data (same as DispatchManagement component)
    console.log('\n🚚 DISPATCH DATA (DispatchManagement component):');
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

    console.log(`   Pending Dispatches (confirmed orders): ${pendingDispatches}`);
    console.log(`   Total Dispatched Weight: ${totalDispatchedWeight}kg`);

    // Test warehouse data (same as WarehouseEntry component)
    console.log('\n🏭 WAREHOUSE DATA (WarehouseEntry component):');
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

    console.log(`   Total Warehouse Entries: ${warehouseEntries?.length || 0}`);
    console.log(`   Total Weight: ${totalWarehouseWeight}kg`);
    console.log(`   Total Pieces: ${totalWarehousePieces}`);
    console.log(`   Average Temperature: ${avgTemperature.toFixed(1)}°C (from ${entriesWithTemp.length} entries)`);

    // Test processing data (same as ProcessingManagement component)
    console.log('\n⚙️ PROCESSING DATA (ProcessingManagement component):');
    const { data: processingRecords } = await supabase
      .from('processing_records')
      .select('ready_for_dispatch_count, post_processing_weight, processing_date')
      .not('ready_for_dispatch_count', 'is', null);

    const totalReadyForDispatch = processingRecords?.reduce((sum, record) => sum + (record.ready_for_dispatch_count || 0), 0) || 0;
    const totalProcessedWeight = processingRecords?.reduce((sum, record) => sum + (record.post_processing_weight || 0), 0) || 0;

    console.log(`   Processing Records: ${processingRecords?.length || 0}`);
    console.log(`   Ready for Dispatch: ${totalReadyForDispatch} pieces`);
    console.log(`   Total Processed Weight: ${totalProcessedWeight}kg`);

    console.log('\n✅ DASHBOARD REAL DATA TEST COMPLETED!');
    console.log('\n📊 EXPECTED DASHBOARD VALUES (from real component data):');
    console.log(`   Inventory Items: ${totalInventoryPieces} (from sorting_results)`);
    console.log(`   Average Fish Size: ${avgFishSize.toFixed(2)}kg (from inventory data)`);
    console.log(`   Average Temperature: ${avgTemperature.toFixed(1)}°C (from warehouse entries)`);
    console.log(`   Pending Dispatches: ${pendingDispatches} (confirmed orders ready for dispatch)`);
    console.log(`   Total Orders: ${totalOrders} (from outlet_orders)`);
    console.log(`   Ready for Dispatch: ${totalReadyForDispatch} pieces (from processing_records)`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
testDashboardRealData();
