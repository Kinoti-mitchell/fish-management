// Test script to verify processing records and sorting fixes
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pgpazwlejhysxabtkifz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBncGF6d2xlamh5c3hhYnRraWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NjE0ODksImV4cCI6MjA2OTQzNzQ4OX0.VZjBmh5647fzGgfW8ttNMUirKRXIg1hj0X8pG0dhjD0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testProcessingRecordsQuery() {
  console.log('🔍 Testing processing records query...');
  
  try {
    // Test the query that was causing 406 error
    const { data, error } = await supabase
      .from('processing_records')
      .select('id, processing_code')
      .eq('warehouse_entry_id', '22168c97-5790-46d9-977d-ad8df8a782d8')
      .single();
    
    if (error) {
      console.log('❌ Processing records query error:', error);
      return false;
    } else {
      console.log('✅ Processing records query successful:', data);
      return true;
    }
  } catch (error) {
    console.log('❌ Processing records query exception:', error);
    return false;
  }
}

async function testAddStockFromSorting() {
  console.log('🔍 Testing add_stock_from_sorting RPC...');
  
  try {
    // First, get a completed sorting batch
    const { data: sortingBatches, error: batchError } = await supabase
      .from('sorting_batches')
      .select('id, status')
      .eq('status', 'completed')
      .limit(1);
    
    if (batchError) {
      console.log('❌ Error fetching sorting batches:', batchError);
      return false;
    }
    
    if (!sortingBatches || sortingBatches.length === 0) {
      console.log('⚠️ No completed sorting batches found for testing');
      return true; // Not an error, just no data to test
    }
    
    const testBatchId = sortingBatches[0].id;
    console.log('📦 Testing with sorting batch:', testBatchId);
    
    // Test the RPC function
    const { data, error } = await supabase
      .rpc('add_stock_from_sorting', {
        p_sorting_batch_id: testBatchId
      });
    
    if (error) {
      console.log('❌ add_stock_from_sorting RPC error:', error);
      return false;
    } else {
      console.log('✅ add_stock_from_sorting RPC successful:', data);
      return true;
    }
  } catch (error) {
    console.log('❌ add_stock_from_sorting RPC exception:', error);
    return false;
  }
}

async function testGeneralQueries() {
  console.log('🔍 Testing general table access...');
  
  const tables = ['processing_records', 'sorting_batches', 'sorting_results', 'inventory_entries'];
  const results = {};
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ ${table} access error:`, error);
        results[table] = false;
      } else {
        console.log(`✅ ${table} access successful`);
        results[table] = true;
      }
    } catch (error) {
      console.log(`❌ ${table} access exception:`, error);
      results[table] = false;
    }
  }
  
  return results;
}

async function runTests() {
  console.log('🚀 Starting processing and sorting error tests...\n');
  
  const test1 = await testProcessingRecordsQuery();
  console.log('');
  
  const test2 = await testAddStockFromSorting();
  console.log('');
  
  const test3 = await testGeneralQueries();
  console.log('');
  
  console.log('📊 Test Results Summary:');
  console.log('Processing Records Query:', test1 ? '✅ PASS' : '❌ FAIL');
  console.log('Add Stock From Sorting RPC:', test2 ? '✅ PASS' : '❌ FAIL');
  console.log('General Table Access:');
  Object.entries(test3).forEach(([table, result]) => {
    console.log(`  ${table}:`, result ? '✅ PASS' : '❌ FAIL');
  });
  
  const allPassed = test1 && test2 && Object.values(test3).every(r => r);
  console.log('\n🎯 Overall Result:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
  
  if (allPassed) {
    console.log('🎉 The processing and sorting errors have been fixed!');
  } else {
    console.log('⚠️ Some issues remain. Check the error messages above.');
  }
}

// Run the tests
runTests().catch(console.error);
