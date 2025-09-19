#!/usr/bin/env node

/**
 * Check Existing Table Structure
 * This script checks what tables and columns already exist
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

async function checkTableStructure() {
  console.log('🔍 Checking existing table structure...\n');
  
  try {
    // Check outlet_receiving table
    console.log('📋 outlet_receiving table:');
    const { data: outletData, error: outletError } = await supabase
      .from('outlet_receiving')
      .select('*')
      .limit(1);
    
    if (outletError) {
      console.log('❌ Error:', outletError.message);
    } else if (outletData && outletData.length > 0) {
      console.log('✅ Columns found:');
      Object.keys(outletData[0]).forEach(col => {
        console.log(`   - ${col}: ${typeof outletData[0][col]}`);
      });
    } else {
      console.log('⚠️  No data to check structure');
    }
    
    // Check dispatch_records table
    console.log('\n📦 dispatch_records table:');
    const { data: dispatchData, error: dispatchError } = await supabase
      .from('dispatch_records')
      .select('*')
      .limit(1);
    
    if (dispatchError) {
      console.log('❌ Error:', dispatchError.message);
    } else if (dispatchData && dispatchData.length > 0) {
      console.log('✅ Columns found:');
      Object.keys(dispatchData[0]).forEach(col => {
        console.log(`   - ${col}: ${typeof dispatchData[0][col]}`);
      });
    } else {
      console.log('⚠️  No data to check structure');
    }
    
    // Check outlet_orders table
    console.log('\n📋 outlet_orders table:');
    const { data: ordersData, error: ordersError } = await supabase
      .from('outlet_orders')
      .select('*')
      .limit(1);
    
    if (ordersError) {
      console.log('❌ Error:', ordersError.message);
    } else if (ordersData && ordersData.length > 0) {
      console.log('✅ Columns found:');
      Object.keys(ordersData[0]).forEach(col => {
        console.log(`   - ${col}: ${typeof ordersData[0][col]}`);
      });
    } else {
      console.log('⚠️  No data to check structure');
    }
    
    // Check outlets table
    console.log('\n🏪 outlets table:');
    const { data: outletsData, error: outletsError } = await supabase
      .from('outlets')
      .select('*')
      .limit(1);
    
    if (outletsError) {
      console.log('❌ Error:', outletsError.message);
    } else if (outletsData && outletsData.length > 0) {
      console.log('✅ Columns found:');
      Object.keys(outletsData[0]).forEach(col => {
        console.log(`   - ${col}: ${typeof outletsData[0][col]}`);
      });
    } else {
      console.log('⚠️  No data to check structure');
    }
    
  } catch (error) {
    console.error('❌ Error checking structure:', error);
  }
}

async function testDirectAccess() {
  console.log('\n🔍 Testing direct table access...');
  
  try {
    // Test direct access to outlet_receiving
    const { data, error } = await supabase
      .from('outlet_receiving')
      .select(`
        *,
        dispatch_records!inner(destination, dispatch_date),
        outlet_orders!inner(order_number),
        outlets!inner(name, location)
      `)
      .limit(1);
    
    if (error) {
      console.log('❌ Direct access error:', error.message);
    } else {
      console.log('✅ Direct access works!');
      console.log(`📊 Found ${data?.length || 0} records with joins`);
    }
    
  } catch (error) {
    console.log('❌ Direct access test error:', error.message);
  }
}

async function main() {
  console.log('🚀 Checking existing table structure for simple solution...\n');
  
  await checkTableStructure();
  await testDirectAccess();
  
  console.log('\n📋 Recommendation:');
  console.log('Instead of complex functions, we can use simple direct table access');
  console.log('This will be more reliable and easier to maintain');
}

main().catch(console.error);
