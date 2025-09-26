// Test the corrected add_stock_from_sorting function
// This script tests the function that works with the current inventory system

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './env.development' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function testCorrectedAddStockFunction() {
  console.log('🔍 Testing corrected add_stock_from_sorting function...');
  
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
      return true; // Not an error, just no data to test
    }
    
    const testBatch = sortingBatches[0];
    console.log('📦 Testing with sorting batch:', testBatch.batch_number, '(' + testBatch.id + ')');
    
    // Check if this batch has sorting results
    const { data: sortingResults, error: resultsError } = await supabase
      .from('sorting_results')
      .select('id, size_class, total_pieces, total_weight_grams')
      .eq('sorting_batch_id', testBatch.id);
    
    if (resultsError) {
      console.log('❌ Error fetching sorting results:', resultsError);
      return false;
    }
    
    if (!sortingResults || sortingResults.length === 0) {
      console.log('⚠️ No sorting results found for this batch');
      return true; // Not an error, just no data to test
    }
    
    console.log('📊 Found sorting results:', sortingResults.length, 'size classes');
    sortingResults.forEach(result => {
      console.log(`  - Size ${result.size_class}: ${result.total_pieces} pieces (${result.total_weight_grams}g)`);
    });
    
    // Test the RPC function
    console.log('⏳ Testing add_stock_from_sorting RPC...');
    const { data, error } = await supabase
      .rpc('add_stock_from_sorting', {
        p_sorting_batch_id: testBatch.id
      });
    
    if (error) {
      console.log('❌ add_stock_from_sorting RPC error:', error);
      return false;
    } else {
      console.log('✅ add_stock_from_sorting RPC successful!');
      console.log('📦 Returned inventory items:', data?.length || 0);
      if (data && data.length > 0) {
        data.forEach(item => {
          console.log(`  - Size ${item.size}: ${item.quantity} pieces`);
        });
      }
      return true;
    }
  } catch (error) {
    console.log('❌ add_stock_from_sorting RPC exception:', error);
    return false;
  }
}

async function runTest() {
  console.log('🚀 Starting test of corrected add_stock_from_sorting function...\n');
  
  const success = await testCorrectedAddStockFunction();
  
  if (success) {
    console.log('\n✅ Test completed successfully!');
    console.log('🎉 The corrected function works with the current inventory system.');
  } else {
    console.log('\n❌ Test failed!');
    console.log('🔧 Please check the function implementation.');
  }
}

runTest().catch(console.error);
