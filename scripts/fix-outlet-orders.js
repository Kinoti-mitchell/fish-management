#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

console.log('🔧 Fixing outlet orders schema and data...\n');

// Read the service key from file
let serviceKey;
try {
  serviceKey = fs.readFileSync('SUPABASE_SERVICE_ROLE_KEY', 'utf8').trim();
} catch (error) {
  console.error('❌ Could not read service key file:', error.message);
  process.exit(1);
}

// Get Supabase URL from environment or use default
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pgpazwlejhysxabtkifz.supabase.co';

if (!serviceKey) {
  console.error('❌ Service key is empty');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function fixOutletOrders() {
  try {
    console.log('1. Checking outlets table...');
    
    // Check if outlets table exists and has data
    const { data: outlets, error: outletsError } = await supabase
      .from('outlets')
      .select('*')
      .limit(5);
    
    if (outletsError) {
      console.log('❌ Outlets table error:', outletsError.message);
      console.log('📝 Please run the outlets schema fix first: db/fix_outlets_schema.sql');
      return;
    }
    
    console.log('✅ Outlets table accessible:', outlets?.length || 0, 'records');
    if (outlets && outlets.length > 0) {
      console.log('Sample outlet:', outlets[0]);
    }
    
    console.log('\n2. Checking outlet_orders table...');
    
    // Check if outlet_orders table exists
    const { data: orders, error: ordersError } = await supabase
      .from('outlet_orders')
      .select('*')
      .limit(1);
    
    if (ordersError) {
      console.log('❌ Outlet orders table error:', ordersError.message);
      console.log('📝 Please run the outlet orders schema fix: db/fix_outlet_orders_schema.sql');
      return;
    }
    
    console.log('✅ Outlet orders table accessible:', orders?.length || 0, 'records');
    
    console.log('\n3. Testing order creation...');
    
    if (outlets && outlets.length > 0) {
      // Try to create a test order
      const testOrder = {
        outlet_id: outlets[0].id,
        requested_sizes: [2, 3, 4],
        requested_quantity: 50,
        requested_grade: 'A',
        price_per_kg: 450.00,
        total_value: 22500.00,
        status: 'pending',
        notes: 'Test order for schema validation'
      };
      
      const { data: newOrder, error: createError } = await supabase
        .from('outlet_orders')
        .insert([testOrder])
        .select(`
          *,
          outlet:outlets(name, location, phone, manager_name, status)
        `)
        .single();
      
      if (createError) {
        console.error('❌ Error creating test order:', createError.message);
      } else {
        console.log('✅ Test order created successfully:', newOrder);
        
        // Clean up test order
        await supabase
          .from('outlet_orders')
          .delete()
          .eq('id', newOrder.id);
        console.log('🧹 Test order cleaned up');
      }
    }
    
    console.log('\n4. Testing order fetching...');
    
    // Test fetching orders with outlet data
    const { data: allOrders, error: fetchError } = await supabase
      .from('outlet_orders')
      .select(`
        *,
        outlet:outlets(name, location, phone, manager_name, status)
      `)
      .order('order_date', { ascending: false });
    
    if (fetchError) {
      console.error('❌ Error fetching orders:', fetchError.message);
    } else {
      console.log('✅ Successfully fetched orders:', allOrders?.length || 0, 'records');
      if (allOrders && allOrders.length > 0) {
        console.log('Sample order with outlet data:', allOrders[0]);
      }
    }
    
    console.log('\n🎉 Outlet orders fix completed!');
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  }
}

fixOutletOrders();
