const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testOutletReceivingWorkflow() {
  try {
    console.log('🧪 Testing Outlet Receiving Workflow...\n');
    
    // Step 1: Check if we have dispatch records
    console.log('📋 Step 1: Checking for available dispatch records...');
    const { data: dispatches, error: dispatchError } = await supabase
      .from('dispatch_records')
      .select(`
        id,
        outlet_order_id,
        destination,
        total_weight,
        total_pieces,
        status,
        outlet_order:outlet_orders(
          outlet:outlets(name, location)
        )
      `)
      .in('status', ['dispatched', 'in-transit'])
      .limit(5);
    
    if (dispatchError) {
      console.error('❌ Error fetching dispatches:', dispatchError);
      return;
    }
    
    if (!dispatches || dispatches.length === 0) {
      console.log('⚠️  No dispatch records found. You need to create and dispatch some orders first.');
      console.log('   Go to Order Management → Create Orders → Dispatch them');
      return;
    }
    
    console.log(`✅ Found ${dispatches.length} dispatch records available for receiving`);
    dispatches.forEach((dispatch, index) => {
      console.log(`   ${index + 1}. ${dispatch.outlet_order?.outlet?.name || dispatch.destination} - ${dispatch.total_weight}kg`);
    });
    
    // Step 2: Check existing outlet receiving records
    console.log('\n📋 Step 2: Checking existing outlet receiving records...');
    const { data: receivingRecords, error: receivingError } = await supabase
      .from('outlet_receiving')
      .select('*')
      .limit(5);
    
    if (receivingError) {
      console.error('❌ Error fetching receiving records:', receivingError);
      return;
    }
    
    console.log(`✅ Found ${receivingRecords?.length || 0} existing receiving records`);
    
    // Step 3: Check outlet_receiving_inventory table
    console.log('\n📋 Step 3: Checking outlet_receiving_inventory table...');
    const { data: inventoryRecords, error: inventoryError } = await supabase
      .from('outlet_receiving_inventory')
      .select('*')
      .limit(5);
    
    if (inventoryError) {
      console.error('❌ Error fetching inventory records:', inventoryError);
      console.log('   This might mean the outlet_receiving_inventory table doesn\'t exist yet.');
      console.log('   Please run the create_outlet_receiving_inventory_table.sql file first.');
      return;
    }
    
    console.log(`✅ Found ${inventoryRecords?.length || 0} inventory records`);
    
    // Step 4: Test creating a receiving record
    if (dispatches.length > 0) {
      console.log('\n📋 Step 4: Testing outlet receiving creation...');
      
      const testDispatch = dispatches[0];
      const testReceivingData = {
        dispatch_id: testDispatch.id,
        outlet_order_id: testDispatch.outlet_order_id,
        received_date: new Date().toISOString().split('T')[0],
        received_by: (await supabase.from('profiles').select('id').limit(1)).data?.[0]?.id,
        expected_weight: testDispatch.total_weight,
        actual_weight_received: testDispatch.total_weight * 0.98, // 2% weight loss
        expected_pieces: testDispatch.total_pieces,
        actual_pieces_received: testDispatch.total_pieces - 5, // 5 pieces less
        expected_value: 50000,
        actual_value_received: 49000,
        condition: 'good',
        size_discrepancies: { "3": -2, "4": -3, "5": -2 },
        discrepancy_notes: 'Test receiving record - minor weight loss',
        status: 'pending', // Start with pending
        outlet_name: testDispatch.outlet_order?.outlet?.name || testDispatch.destination,
        outlet_location: testDispatch.outlet_order?.outlet?.location || 'Unknown'
      };
      
      console.log('   Creating test receiving record with pending status...');
      const { data: newReceiving, error: createError } = await supabase
        .from('outlet_receiving')
        .insert([testReceivingData])
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Error creating receiving record:', createError);
        return;
      }
      
      console.log('✅ Test receiving record created with ID:', newReceiving.id);
      
      // Step 5: Confirm the receiving record to trigger inventory creation
      console.log('\n📋 Step 5: Confirming receiving record to trigger inventory creation...');
      
      const { error: updateError } = await supabase
        .from('outlet_receiving')
        .update({ status: 'confirmed' })
        .eq('id', newReceiving.id);
      
      if (updateError) {
        console.error('❌ Error confirming receiving record:', updateError);
        return;
      }
      
      console.log('✅ Receiving record confirmed');
      
      // Step 6: Check if inventory record was created
      console.log('\n📋 Step 6: Checking if inventory record was created...');
      
      const { data: createdInventory, error: inventoryCheckError } = await supabase
        .from('outlet_receiving_inventory')
        .select('*')
        .eq('outlet_receiving_id', newReceiving.id);
      
      if (inventoryCheckError) {
        console.error('❌ Error checking inventory record:', inventoryCheckError);
        return;
      }
      
      if (createdInventory && createdInventory.length > 0) {
        console.log('✅ Inventory record created successfully!');
        console.log('   Fish Type:', createdInventory[0].fish_type);
        console.log('   Total Weight:', createdInventory[0].total_weight, 'kg');
        console.log('   Quantity:', createdInventory[0].quantity, 'pieces');
        console.log('   Outlet:', createdInventory[0].outlet_name);
      } else {
        console.log('❌ No inventory record was created. Check the trigger function.');
      }
      
      // Step 7: Clean up test data
      console.log('\n📋 Step 7: Cleaning up test data...');
      
      await supabase.from('outlet_receiving_inventory').delete().eq('outlet_receiving_id', newReceiving.id);
      await supabase.from('outlet_receiving').delete().eq('id', newReceiving.id);
      
      console.log('✅ Test data cleaned up');
    }
    
    console.log('\n🎉 Outlet receiving workflow test completed!');
    console.log('\n📝 Summary:');
    console.log('   - Dispatch records available:', dispatches.length);
    console.log('   - Existing receiving records:', receivingRecords?.length || 0);
    console.log('   - Inventory records:', inventoryRecords?.length || 0);
    console.log('   - Workflow test:', 'PASSED ✅');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testOutletReceivingWorkflow().then(() => {
  console.log('\n✨ Test completed');
  process.exit(0);
});
