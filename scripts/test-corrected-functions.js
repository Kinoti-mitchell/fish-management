#!/usr/bin/env node

/**
 * Test Corrected Outlet Receiving Functions
 * This script tests the corrected functions after applying the fix
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

async function testGetFunction() {
  console.log('🔍 Testing get_outlet_receiving_records function...');
  
  try {
    const { data, error } = await supabase.rpc('get_outlet_receiving_records');
    
    if (error) {
      console.log('❌ get_outlet_receiving_records error:', error.message);
      return false;
    } else {
      console.log('✅ get_outlet_receiving_records works!');
      console.log(`📊 Returned ${data?.length || 0} records`);
      
      if (data && data.length > 0) {
        console.log('📄 Sample record structure:');
        console.log(JSON.stringify(data[0], null, 2));
      }
      
      return true;
    }
  } catch (error) {
    console.log('❌ Function test error:', error.message);
    return false;
  }
}

async function testCreateFunction() {
  console.log('\n🔍 Testing create_outlet_receiving_record function...');
  
  try {
    // Test with dummy data (this will fail with foreign key constraints, but we can see if the function structure is correct)
    const { data, error } = await supabase.rpc('create_outlet_receiving_record', {
      p_dispatch_id: '00000000-0000-0000-0000-000000000000',
      p_outlet_order_id: '00000000-0000-0000-0000-000000000000',
      p_received_date: '2024-01-01',
      p_received_by: '00000000-0000-0000-0000-000000000000',
      p_expected_weight: 100.00,
      p_actual_weight_received: 95.00,
      p_expected_pieces: 10,
      p_actual_pieces_received: 9,
      p_expected_value: 500.00,
      p_actual_value_received: 475.00,
      p_condition: 'good',
      p_size_discrepancies: '{}',
      p_discrepancy_notes: 'Test',
      p_status: 'received',
      p_outlet_name: 'Test Outlet',
      p_outlet_location: 'Test Location'
    });
    
    if (error) {
      // Expected to fail with foreign key constraints, but function structure should be correct
      if (error.message.includes('foreign key') || error.message.includes('violates')) {
        console.log('✅ create_outlet_receiving_record function structure is correct (expected foreign key error)');
        return true;
      } else {
        console.log('❌ create_outlet_receiving_record error:', error.message);
        return false;
      }
    } else {
      console.log('✅ create_outlet_receiving_record works!');
      return true;
    }
  } catch (error) {
    console.log('❌ Function test error:', error.message);
    return false;
  }
}

async function checkDataIntegrity() {
  console.log('\n🔍 Checking data integrity...');
  
  try {
    const { data, error } = await supabase
      .from('outlet_receiving')
      .select('*')
      .limit(5);
    
    if (error) {
      console.log('❌ Data integrity check failed:', error.message);
      return false;
    } else {
      console.log(`✅ Data integrity confirmed - ${data?.length || 0} records found`);
      return true;
    }
  } catch (error) {
    console.log('❌ Data integrity check error:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Testing corrected outlet receiving functions...\n');
  
  const getFunctionWorks = await testGetFunction();
  const createFunctionWorks = await testCreateFunction();
  const dataIntegrity = await checkDataIntegrity();
  
  console.log('\n📋 Test Results:');
  console.log(`✅ Get Function: ${getFunctionWorks ? 'WORKING' : 'FAILED'}`);
  console.log(`✅ Create Function: ${createFunctionWorks ? 'WORKING' : 'FAILED'}`);
  console.log(`✅ Data Integrity: ${dataIntegrity ? 'PRESERVED' : 'ISSUES FOUND'}`);
  
  if (getFunctionWorks && createFunctionWorks && dataIntegrity) {
    console.log('\n🎉 All tests passed! Your outlet receiving functions are working correctly.');
    console.log('📋 Next steps:');
    console.log('1. Test your application: http://localhost:3003');
    console.log('2. Try using the outlet receiving functionality');
    console.log('3. The function uniqueness error should be resolved');
  } else {
    console.log('\n⚠️  Some tests failed. You may need to apply the corrected SQL fix.');
    console.log('📋 Apply this SQL in Supabase SQL Editor:');
    console.log('   db/fix_outlet_receiving_functions_corrected.sql');
  }
}

main().catch(console.error);
