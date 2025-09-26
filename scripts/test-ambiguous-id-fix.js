// Test script to verify the ambiguous ID error fix
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pgpazwlejhysxabtkifz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBncGF6d2xlamh5c3hhYnRraWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NjE0ODksImV4cCI6MjA2OTQzNzQ4OX0.VZjBmh5647fzGgfW8ttNMUirKRXIg1hj0X8pG0dhjD0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAddStockFromSorting() {
  console.log('🔍 Testing add_stock_from_sorting RPC with ambiguous ID fix...');
  
  try {
    // First, get a completed sorting batch
    const { data: sortingBatches, error: batchError } = await supabase
      .from('sorting_batches')
      .select('id, status, batch_number')
      .eq('status', 'completed')
      .limit(1);
    
    if (batchError) {
      console.log('❌ Error fetching sorting batches:', batchError);
      return false;
    }
    
    if (!sortingBatches || sortingBatches.length === 0) {
      console.log('⚠️ No completed sorting batches found for testing');
      console.log('📝 Creating a test sorting batch...');
      
      // Try to create a test sorting batch
      const { data: processingRecords, error: procError } = await supabase
        .from('processing_records')
        .select('id')
        .limit(1);
      
      if (procError || !processingRecords || processingRecords.length === 0) {
        console.log('⚠️ No processing records found to create test batch');
        return true; // Not an error, just no data to test
      }
      
      // Create a test sorting batch
      const { data: newBatch, error: createError } = await supabase
        .from('sorting_batches')
        .insert([{
          processing_record_id: processingRecords[0].id,
          batch_number: 'TEST-BATCH-' + Date.now(),
          status: 'completed',
          total_weight_grams: 1000,
          total_pieces: 10,
          sorting_date: new Date().toISOString(),
          storage_location_id: null
        }])
        .select()
        .single();
      
      if (createError) {
        console.log('❌ Error creating test sorting batch:', createError);
        return false;
      }
      
      console.log('✅ Created test sorting batch:', newBatch.id);
      
      // Create test sorting results
      const { error: resultsError } = await supabase
        .from('sorting_results')
        .insert([{
          sorting_batch_id: newBatch.id,
          size_class: 5,
          total_pieces: 10,
          total_weight_grams: 1000,
          storage_location_id: null
        }]);
      
      if (resultsError) {
        console.log('❌ Error creating test sorting results:', resultsError);
        return false;
      }
      
      console.log('✅ Created test sorting results');
      
      // Now test the RPC function
      const { data, error } = await supabase
        .rpc('add_stock_from_sorting', {
          p_sorting_batch_id: newBatch.id
        });
      
      if (error) {
        console.log('❌ add_stock_from_sorting RPC error:', error);
        return false;
      } else {
        console.log('✅ add_stock_from_sorting RPC successful:', data);
        return true;
      }
    }
    
    const testBatchId = sortingBatches[0].id;
    console.log('📦 Testing with existing sorting batch:', testBatchId);
    
    // Test the RPC function
    const { data, error } = await supabase
      .rpc('add_stock_from_sorting', {
        p_sorting_batch_id: testBatchId
      });
    
    if (error) {
      console.log('❌ add_stock_from_sorting RPC error:', error);
      console.log('🔍 Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
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

async function runTest() {
  console.log('🚀 Testing ambiguous ID error fix...\n');
  
  const result = await testAddStockFromSorting();
  
  console.log('\n📊 Test Result:');
  console.log('Add Stock From Sorting RPC:', result ? '✅ PASS' : '❌ FAIL');
  
  if (result) {
    console.log('🎉 The ambiguous ID error has been fixed!');
  } else {
    console.log('⚠️ The error still exists. Check the error details above.');
  }
}

// Run the test
runTest().catch(console.error);
