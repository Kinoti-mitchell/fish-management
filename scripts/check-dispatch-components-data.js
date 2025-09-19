// Script to check what dispatch components are actually using for pending dispatches
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

async function checkDispatchComponentsData() {
  try {
    console.log('🔍 Checking dispatch components data...\n');

    // Check dispatch_records table (what OutletReceiving component uses)
    console.log('🚚 DISPATCH RECORDS (OutletReceiving component):');
    const { data: dispatchRecords, error: drError } = await supabase
      .from('dispatch_records')
      .select('*')
      .order('dispatch_date', { ascending: false });

    if (drError) {
      console.error('❌ Error fetching dispatch records:', drError);
    } else {
      console.log(`   Total dispatch records: ${dispatchRecords?.length || 0}`);
      
      if (dispatchRecords && dispatchRecords.length > 0) {
        // Group by status
        const statusGroups = dispatchRecords.reduce((acc, record) => {
          const status = record.status || 'unknown';
          if (!acc[status]) {
            acc[status] = { count: 0, records: [] };
          }
          acc[status].count += 1;
          acc[status].records.push(record);
          return acc;
        }, {});

        console.log('\n   Status breakdown:');
        Object.entries(statusGroups).forEach(([status, data]) => {
          console.log(`   ${status}: ${data.count} records`);
        });

        // Check what OutletReceiving considers as "pending" (in-transit, dispatched, scheduled)
        const outletReceivingPending = dispatchRecords.filter(record => 
          ['in-transit', 'dispatched', 'scheduled'].includes(record.status)
        );
        console.log(`\n   OutletReceiving "pending" (in-transit, dispatched, scheduled): ${outletReceivingPending.length}`);

        // Check what dashboard service was looking for
        const dashboardPending = dispatchRecords.filter(record => 
          ['scheduled', 'pending'].includes(record.status)
        );
        console.log(`   Dashboard service "pending" (scheduled, pending): ${dashboardPending.length}`);

        // Check what dashboard service should look for (fixed)
        const fixedDashboardPending = dispatchRecords.filter(record => 
          ['scheduled', 'in-transit'].includes(record.status)
        );
        console.log(`   Fixed dashboard "pending" (scheduled, in-transit): ${fixedDashboardPending.length}`);
      }
    }

    // Check outlet_orders table (what DispatchManagement component uses)
    console.log('\n🏪 OUTLET ORDERS (DispatchManagement component):');
    const { data: outletOrders, error: ooError } = await supabase
      .from('outlet_orders')
      .select('*')
      .order('order_date', { ascending: false });

    if (ooError) {
      console.error('❌ Error fetching outlet orders:', ooError);
    } else {
      console.log(`   Total outlet orders: ${outletOrders?.length || 0}`);
      
      if (outletOrders && outletOrders.length > 0) {
        // Group by status
        const statusGroups = outletOrders.reduce((acc, order) => {
          const status = order.status || 'unknown';
          if (!acc[status]) {
            acc[status] = { count: 0, orders: [] };
          }
          acc[status].count += 1;
          acc[status].orders.push(order);
          return acc;
        }, {});

        console.log('\n   Status breakdown:');
        Object.entries(statusGroups).forEach(([status, data]) => {
          console.log(`   ${status}: ${data.count} orders`);
        });

        // Check what DispatchManagement considers as "confirmed" (ready for dispatch)
        const confirmedOrders = outletOrders.filter(order => 
          order.status === 'confirmed'
        );
        console.log(`\n   Confirmed orders (ready for dispatch): ${confirmedOrders.length}`);

        // Check what DispatchManagement considers as "dispatched"
        const dispatchedOrders = outletOrders.filter(order => 
          order.status === 'dispatched'
        );
        console.log(`   Dispatched orders: ${dispatchedOrders.length}`);

        // Check pending orders
        const pendingOrders = outletOrders.filter(order => 
          order.status === 'pending'
        );
        console.log(`   Pending orders: ${pendingOrders.length}`);
      }
    }

    // Check what the dashboard should actually show
    console.log('\n📊 DASHBOARD PENDING DISPATCH CALCULATION:');
    
    // Option 1: Use dispatch_records with in-transit/scheduled status
    const dispatchRecordsPending = dispatchRecords?.filter(record => 
      ['scheduled', 'in-transit'].includes(record.status)
    ) || [];
    console.log(`   Option 1 - Dispatch records pending: ${dispatchRecordsPending.length}`);

    // Option 2: Use outlet_orders with confirmed status (ready for dispatch)
    const outletOrdersPending = outletOrders?.filter(order => 
      order.status === 'confirmed'
    ) || [];
    console.log(`   Option 2 - Outlet orders confirmed (ready for dispatch): ${outletOrdersPending.length}`);

    // Option 3: Use outlet_orders with pending status
    const outletOrdersPendingStatus = outletOrders?.filter(order => 
      order.status === 'pending'
    ) || [];
    console.log(`   Option 3 - Outlet orders pending: ${outletOrdersPendingStatus.length}`);

    console.log('\n✅ Dispatch components data check completed!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
checkDispatchComponentsData();
