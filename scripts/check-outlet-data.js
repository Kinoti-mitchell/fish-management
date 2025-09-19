#!/usr/bin/env node

/**
 * Check Outlet Receiving Data
 * This script checks what data exists in the outlet_receiving table
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

async function checkOutletData() {
  console.log('🔍 Checking outlet receiving data...\n');
  
  try {
    // Check if table exists and get basic info
    const { data: tableInfo, error: tableError } = await supabase
      .from('outlet_receiving')
      .select('*')
      .limit(5);
    
    if (tableError) {
      console.error('❌ Error accessing outlet_receiving table:', tableError.message);
      return;
    }
    
    console.log(`📊 Found ${tableInfo?.length || 0} records in outlet_receiving table`);
    
    if (tableInfo && tableInfo.length > 0) {
      console.log('✅ Data exists! Sample record:');
      console.log(JSON.stringify(tableInfo[0], null, 2));
    } else {
      console.log('⚠️  No data found in outlet_receiving table');
    }
    
    // Check table structure
    console.log('\n🔍 Checking table structure...');
    const { data: structure, error: structureError } = await supabase
      .from('outlet_receiving')
      .select('*')
      .limit(0);
    
    if (structureError) {
      console.error('❌ Error checking table structure:', structureError.message);
    } else {
      console.log('✅ Table structure is accessible');
    }
    
    // Check related tables
    console.log('\n🔍 Checking related tables...');
    
    const { data: dispatchData, error: dispatchError } = await supabase
      .from('dispatch_records')
      .select('id, destination, dispatch_date, status')
      .limit(3);
    
    if (dispatchError) {
      console.log('⚠️  Dispatch records error:', dispatchError.message);
    } else {
      console.log(`📦 Found ${dispatchData?.length || 0} dispatch records`);
    }
    
    const { data: outletOrders, error: ordersError } = await supabase
      .from('outlet_orders')
      .select('id, order_number, outlet_id')
      .limit(3);
    
    if (ordersError) {
      console.log('⚠️  Outlet orders error:', ordersError.message);
    } else {
      console.log(`📋 Found ${outletOrders?.length || 0} outlet orders`);
    }
    
  } catch (error) {
    console.error('❌ Error checking data:', error);
  }
}

async function testCurrentFunctions() {
  console.log('\n🔍 Testing current functions...');
  
  try {
    // Test the get function
    const { data, error } = await supabase.rpc('get_outlet_receiving_records');
    
    if (error) {
      console.log('❌ get_outlet_receiving_records error:', error.message);
    } else {
      console.log('✅ get_outlet_receiving_records works!');
      console.log(`📊 Returned ${data?.length || 0} records`);
    }
    
  } catch (error) {
    console.log('❌ Function test error:', error.message);
  }
}

async function main() {
  console.log('🚀 Checking outlet receiving data and functions...\n');
  
  await checkOutletData();
  await testCurrentFunctions();
  
  console.log('\n📋 Summary:');
  console.log('1. Check the data status above');
  console.log('2. If data exists, we can fix the function structure');
  console.log('3. If data is missing, we may need to restore from backup');
}

main().catch(console.error);
