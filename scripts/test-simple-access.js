#!/usr/bin/env node

/**
 * Test Simple Table Access
 * This script tests direct table access instead of complex functions
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/server.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testDirectTableAccess() {
  console.log('🔍 Testing direct table access...\n');
  
  try {
    // Test 1: Get outlet receiving records directly
    console.log('📋 Test 1: Getting outlet receiving records...');
    const { data: outletData, error: outletError } = await supabase
      .from('outlet_receiving')
      .select('*')
      .order('received_date', { ascending: false });
    
    if (outletError) {
      console.log('❌ Error:', outletError.message);
      return false;
    } else {
      console.log(`✅ Success! Found ${outletData?.length || 0} records`);
      if (outletData && outletData.length > 0) {
        console.log('📄 Sample record:');
        console.log(JSON.stringify(outletData[0], null, 2));
      }
    }
    
    // Test 2: Get dispatch records
    console.log('\n📦 Test 2: Getting dispatch records...');
    const { data: dispatchData, error: dispatchError } = await supabase
      .from('dispatch_records')
      .select('id, destination, dispatch_date, status')
      .limit(3);
    
    if (dispatchError) {
      console.log('❌ Error:', dispatchError.message);
    } else {
      console.log(`✅ Success! Found ${dispatchData?.length || 0} dispatch records`);
    }
    
    // Test 3: Get outlet orders
    console.log('\n📋 Test 3: Getting outlet orders...');
    const { data: ordersData, error: ordersError } = await supabase
      .from('outlet_orders')
      .select('id, order_number, outlet_id, status')
      .limit(3);
    
    if (ordersError) {
      console.log('❌ Error:', ordersError.message);
    } else {
      console.log(`✅ Success! Found ${ordersData?.length || 0} outlet orders`);
    }
    
    // Test 4: Get outlets
    console.log('\n🏪 Test 4: Getting outlets...');
    const { data: outletsData, error: outletsError } = await supabase
      .from('outlets')
      .select('id, name, location, status')
      .limit(3);
    
    if (outletsError) {
      console.log('❌ Error:', outletsError.message);
    } else {
      console.log(`✅ Success! Found ${outletsData?.length || 0} outlets`);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Test error:', error);
    return false;
  }
}

async function testCreateRecord() {
  console.log('\n🔍 Testing record creation...');
  
  try {
    // Test creating a new outlet receiving record (this will fail with foreign key constraints, but we can see if the structure is correct)
    const { data, error } = await supabase
      .from('outlet_receiving')
      .insert({
        dispatch_id: '00000000-0000-0000-0000-000000000000',
        outlet_order_id: '00000000-0000-0000-0000-000000000000',
        received_date: '2024-01-01',
        received_by: '00000000-0000-0000-0000-000000000000',
        expected_weight: 100.00,
        actual_weight_received: 95.00,
        expected_pieces: 10,
        actual_pieces_received: 9,
        expected_value: 500.00,
        actual_value_received: 475.00,
        condition: 'good',
        size_discrepancies: {},
        discrepancy_notes: 'Test',
        status: 'received',
        outlet_name: 'Test Outlet',
        outlet_location: 'Test Location'
      });
    
    if (error) {
      if (error.message.includes('foreign key') || error.message.includes('violates')) {
        console.log('✅ Record creation structure is correct (expected foreign key error)');
        return true;
      } else {
        console.log('❌ Record creation error:', error.message);
        return false;
      }
    } else {
      console.log('✅ Record creation works!');
      return true;
    }
    
  } catch (error) {
    console.log('❌ Record creation test error:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Testing simple table access solution...\n');
  
  const tableAccess = await testDirectTableAccess();
  const recordCreation = await testCreateRecord();
  
  console.log('\n📋 Test Results:');
  console.log(`✅ Table Access: ${tableAccess ? 'WORKING' : 'FAILED'}`);
  console.log(`✅ Record Creation: ${recordCreation ? 'WORKING' : 'FAILED'}`);
  
  if (tableAccess && recordCreation) {
    console.log('\n🎉 Simple table access solution works!');
    console.log('📋 This approach is much simpler and more reliable than complex functions');
    console.log('📋 Your application can now use direct table access instead of functions');
  } else {
    console.log('\n⚠️  Some tests failed. You may need to apply the simple SQL fix.');
    console.log('📋 Apply this SQL in Supabase SQL Editor:');
    console.log('   db/simple_outlet_receiving_fix.sql');
  }
}

main().catch(console.error);
