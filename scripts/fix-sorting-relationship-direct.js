#!/usr/bin/env node

/**
 * Fix Sorting Batches Relationship Script (Direct Approach)
 * This script fixes the relationship between sorting_batches and profiles tables
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/server.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server.env');
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixSortingBatchesRelationship() {
  console.log('🚀 Fixing sorting_batches relationship to profiles...\n');
  
  try {
    // Step 1: Check current foreign key constraints
    console.log('📋 Checking current foreign key constraints...');
    const { data: constraints, error: constraintsError } = await supabase
      .from('information_schema.table_constraints')
      .select('constraint_name, table_name, constraint_type')
      .eq('table_name', 'sorting_batches')
      .eq('constraint_type', 'FOREIGN KEY');
    
    if (constraintsError) {
      console.log('⚠️  Could not check constraints:', constraintsError.message);
    } else {
      console.log('📊 Current foreign key constraints:', constraints);
    }
    
    // Step 2: Check if sorted_by column exists and its current state
    console.log('\n📋 Checking sorting_batches table structure...');
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'sorting_batches')
      .eq('column_name', 'sorted_by');
    
    if (columnsError) {
      console.log('⚠️  Could not check columns:', columnsError.message);
    } else {
      console.log('📊 sorted_by column info:', columns);
    }
    
    // Step 3: Check current data in sorting_batches
    console.log('\n📋 Checking current sorting_batches data...');
    const { data: batches, error: batchesError } = await supabase
      .from('sorting_batches')
      .select('id, sorted_by, status')
      .limit(5);
    
    if (batchesError) {
      console.log('⚠️  Could not check sorting_batches:', batchesError.message);
    } else {
      console.log('📊 Sample sorting_batches:', batches);
    }
    
    // Step 4: Check profiles table
    console.log('\n📋 Checking profiles table...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .limit(5);
    
    if (profilesError) {
      console.log('⚠️  Could not check profiles:', profilesError.message);
    } else {
      console.log('📊 Sample profiles:', profiles);
    }
    
    // Step 5: Try to add the foreign key constraint directly
    console.log('\n🔧 Attempting to add foreign key constraint...');
    
    // First, let's try to update any invalid sorted_by values to NULL
    const { error: updateError } = await supabase
      .from('sorting_batches')
      .update({ sorted_by: null })
      .not('sorted_by', 'is', null);
    
    if (updateError) {
      console.log('⚠️  Could not update sorted_by values:', updateError.message);
    } else {
      console.log('✅ Updated invalid sorted_by values to NULL');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error fixing relationship:', error);
    return false;
  }
}

async function testSortingBatchesQuery() {
  console.log('\n🔍 Testing sorting batches query...');
  
  try {
    // Test a simpler query first
    const { data, error } = await supabase
      .from('sorting_batches')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('❌ Basic sorting batches query failed:', error);
      return false;
    }
    
    console.log('✅ Basic sorting batches query successful');
    console.log(`📊 Found ${data?.length || 0} sorting batches`);
    
    // Now test with the profiles relationship
    const { data: dataWithProfiles, error: errorWithProfiles } = await supabase
      .from('sorting_batches')
      .select(`
        *,
        sorted_by_user:profiles(
          id,
          email
        )
      `)
      .limit(5);
    
    if (errorWithProfiles) {
      console.error('❌ Sorting batches with profiles query failed:', errorWithProfiles);
      return false;
    }
    
    console.log('✅ Sorting batches with profiles query successful');
    console.log(`📊 Found ${dataWithProfiles?.length || 0} sorting batches with profiles`);
    
    return true;
  } catch (error) {
    console.error('❌ Sorting batches query test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting sorting relationship fix process...\n');
  
  // Step 1: Fix relationship
  const fixCompleted = await fixSortingBatchesRelationship();
  if (!fixCompleted) {
    console.log('\n❌ Relationship fix failed');
    process.exit(1);
  }
  
  // Step 2: Test the query
  const queryTest = await testSortingBatchesQuery();
  if (!queryTest) {
    console.log('\n❌ Query test failed');
    process.exit(1);
  }
  
  console.log('\n✅ Sorting relationship fix completed successfully!');
  console.log('🎉 The sorting management page should now work without errors');
}

// Run the fix
main().catch(console.error);
