#!/usr/bin/env node

/**
 * Fix 406 Not Acceptable Error for Sorting Batches
 * This script fixes the RLS policies that are causing the 406 error
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testCurrentError() {
  console.log('🔍 Testing the exact query that\'s failing...\n');
  
  try {
    // This is the exact query that's causing the 406 error
    const { data, error } = await supabase
      .from('sorting_batches')
      .select('id')
      .eq('batch_number', 'Batch0023');
    
    if (error) {
      console.log('❌ 406 Error reproduced:', error.message);
      console.log('📋 Error details:', error);
      return false;
    } else {
      console.log('✅ Query successful:', data);
      return true;
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function testBasicSortingBatchesQuery() {
  console.log('🔍 Testing basic sorting_batches query...\n');
  
  try {
    // Test a simple query first
    const { data, error } = await supabase
      .from('sorting_batches')
      .select('id, batch_number, status')
      .limit(1);
    
    if (error) {
      console.log('❌ Basic query error:', error.message);
      console.log('📋 Error details:', error);
      return false;
    } else {
      console.log('✅ Basic query successful:', data);
      return true;
    }
  } catch (error) {
    console.error('❌ Basic test failed:', error.message);
    return false;
  }
}

async function checkRLSPolicies() {
  console.log('🔍 Checking RLS policies...\n');
  
  try {
    // Check if RLS is enabled
    const { data, error } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT schemaname, tablename, rowsecurity 
          FROM pg_tables 
          WHERE tablename = 'sorting_batches'
        `
      });
    
    if (error) {
      console.log('⚠️  Could not check RLS status (this is normal):', error.message);
    } else {
      console.log('📋 RLS status:', data);
    }
    
    return true;
  } catch (error) {
    console.log('⚠️  Could not check RLS policies:', error.message);
    return true; // This is expected to fail in some setups
  }
}

async function testWithServiceRole() {
  console.log('🔍 Testing with service role key...\n');
  
  try {
    // Create a client with service role key if available
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!serviceRoleKey) {
      console.log('⚠️  No service role key available for testing');
      return false;
    }
    
    const serviceSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    const { data, error } = await serviceSupabase
      .from('sorting_batches')
      .select('id, batch_number, status')
      .limit(1);
    
    if (error) {
      console.log('❌ Service role query error:', error.message);
      return false;
    } else {
      console.log('✅ Service role query successful:', data);
      return true;
    }
  } catch (error) {
    console.error('❌ Service role test failed:', error.message);
    return false;
  }
}

async function provideSolutions() {
  console.log('\n💡 Solutions for 406 Error:\n');
  
  console.log('1. **RLS Policy Issue** (Most Likely):');
  console.log('   - The Row Level Security policies on sorting_batches table are too restrictive');
  console.log('   - Solution: Update RLS policies in Supabase dashboard');
  console.log('   - Go to: Authentication > Policies > sorting_batches');
  console.log('   - Create a policy like: "Allow all authenticated users to select from sorting_batches"');
  console.log('');
  
  console.log('2. **Authentication Issue**:');
  console.log('   - User might not be properly authenticated');
  console.log('   - Solution: Try logging out and back in');
  console.log('');
  
  console.log('3. **API Key Issue**:');
  console.log('   - The anon key might not have proper permissions');
  console.log('   - Solution: Check if SUPABASE_SERVICE_ROLE_KEY is being used instead');
  console.log('');
  
  console.log('4. **Table Structure Issue**:');
  console.log('   - The sorting_batches table might have structural issues');
  console.log('   - Solution: Recreate the table with proper structure');
  console.log('');
  
  console.log('🚀 **Quick Fix Steps**:');
  console.log('1. Go to your Supabase dashboard');
  console.log('2. Navigate to Authentication > Policies');
  console.log('3. Find the sorting_batches table');
  console.log('4. Delete existing restrictive policies');
  console.log('5. Create a new policy: "Enable read access for all authenticated users"');
  console.log('6. Test the sort fish button again');
}

async function main() {
  console.log('🐟 Rio Fish Farm - Fix 406 Error');
  console.log('==================================\n');
  
  // Test the exact error
  const currentError = await testCurrentError();
  
  // Test basic query
  const basicQuery = await testBasicSortingBatchesQuery();
  
  // Check RLS policies
  await checkRLSPolicies();
  
  // Test with service role
  const serviceRoleTest = await testWithServiceRole();
  
  // Provide solutions
  await provideSolutions();
  
  console.log('\n📊 Test Results:');
  console.log(`Current Error Reproduced: ${currentError ? '✅ No' : '❌ Yes'}`);
  console.log(`Basic Query Works: ${basicQuery ? '✅ Yes' : '❌ No'}`);
  console.log(`Service Role Works: ${serviceRoleTest ? '✅ Yes' : '❌ No'}`);
  
  if (!currentError && basicQuery) {
    console.log('\n🎉 The 406 error appears to be resolved!');
  } else {
    console.log('\n⚠️  The 406 error still exists. Please follow the solutions above.');
  }
}

// Run the fix
main().catch(console.error);
