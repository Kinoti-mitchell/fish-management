#!/usr/bin/env node

/**
 * Test Sorting Fix Script
 * This script tests the current sorting function and provides a workaround
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

async function testCurrentFunction() {
  console.log('🔍 Testing current add_stock_from_sorting function...');
  
  try {
    // Test with Batch0022 from the error
    const batchId = '98d3acb1-53a2-44fe-8ebf-6e62dd5666f7';
    
    console.log(`⏳ Testing with batch ID: ${batchId}`);
    
    const { data, error } = await supabase.rpc('add_stock_from_sorting', {
      p_sorting_batch_id: batchId
    });
    
    if (error) {
      console.log('❌ Current function error:', error.message);
      console.log('📋 Error details:', error);
      return false;
    } else {
      console.log('✅ Function executed successfully');
      console.log('📊 Result:', data);
      return true;
    }
  } catch (error) {
    console.error('❌ Function test failed:', error);
    return false;
  }
}

async function checkBatchDetails() {
  console.log('🔍 Checking batch details...');
  
  try {
    const batchId = '98d3acb1-53a2-44fe-8ebf-6e62dd5666f7';
    
    // Get batch details
    const { data: batchData, error: batchError } = await supabase
      .from('sorting_batches')
      .select('*')
      .eq('id', batchId)
      .single();
    
    if (batchError) {
      console.error('❌ Error fetching batch:', batchError);
      return false;
    }
    
    console.log('📋 Batch details:', {
      id: batchData.id,
      batch_number: batchData.batch_number,
      status: batchData.status,
      size_distribution: batchData.size_distribution,
      created_at: batchData.created_at
    });
    
    // Check if already in inventory
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('inventory_entries')
      .select('*')
      .eq('reference_id', batchId)
      .eq('entry_type', 'sorting');
    
    if (inventoryError) {
      console.error('❌ Error checking inventory:', inventoryError);
    } else {
      console.log('📊 Already in inventory:', inventoryData.length > 0);
      if (inventoryData.length > 0) {
        console.log('📋 Inventory entries:', inventoryData);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error checking batch details:', error);
    return false;
  }
}

async function manualInventoryAdd() {
  console.log('🔧 Manually adding batch to inventory...');
  
  try {
    const batchId = '98d3acb1-53a2-44fe-8ebf-6e62dd5666f7';
    
    // Get batch details
    const { data: batchData, error: batchError } = await supabase
      .from('sorting_batches')
      .select('*')
      .eq('id', batchId)
      .single();
    
    if (batchError) {
      console.error('❌ Error fetching batch:', batchError);
      return false;
    }
    
    console.log('📋 Processing batch:', batchData.batch_number);
    console.log('📊 Size distribution:', batchData.size_distribution);
    
    // Process size distribution
    if (batchData.size_distribution) {
      for (const [sizeStr, quantityStr] of Object.entries(batchData.size_distribution)) {
        const size = parseInt(sizeStr);
        const quantity = parseInt(quantityStr);
        
        if (quantity > 0) {
          console.log(`⏳ Processing size ${size}: ${quantity} pieces`);
          
          // Add to inventory
          const { data: inventoryData, error: inventoryError } = await supabase
            .from('inventory')
            .upsert({
              size: size,
              quantity: quantity
            }, {
              onConflict: 'size'
            })
            .select();
          
          if (inventoryError) {
            console.error(`❌ Error adding size ${size} to inventory:`, inventoryError);
          } else {
            console.log(`✅ Added size ${size} to inventory:`, inventoryData);
          }
          
          // Add inventory entry
          const { data: entryData, error: entryError } = await supabase
            .from('inventory_entries')
            .insert({
              size: size,
              quantity_change: quantity,
              entry_type: 'sorting',
              reference_id: batchId,
              notes: `From sorting batch ${batchData.batch_number} - manual fix`
            })
            .select();
          
          if (entryError) {
            console.error(`❌ Error adding inventory entry for size ${size}:`, entryError);
          } else {
            console.log(`✅ Added inventory entry for size ${size}:`, entryData);
          }
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error in manual inventory add:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting sorting function test and fix...\n');
  
  // Step 1: Test current function
  const functionTest = await testCurrentFunction();
  
  console.log('');
  
  // Step 2: Check batch details
  const batchCheck = await checkBatchDetails();
  
  console.log('');
  
  // Step 3: If function failed, try manual fix
  if (!functionTest) {
    console.log('🔧 Function failed, attempting manual fix...\n');
    const manualFix = await manualInventoryAdd();
    
    if (manualFix) {
      console.log('\n✅ Manual fix completed successfully!');
      console.log('🎉 The batch has been manually added to inventory');
    } else {
      console.log('\n❌ Manual fix failed');
    }
  }
  
  console.log('\n📋 Summary:');
  console.log('1. The ambiguous ID error is in the database function');
  console.log('2. The function needs to be fixed in the Supabase dashboard');
  console.log('3. As a workaround, batches can be manually added to inventory');
  console.log('\n🔧 To fix permanently:');
  console.log('1. Go to Supabase dashboard > SQL Editor');
  console.log('2. Run the SQL from db/fix_ambiguous_id_error.sql');
  console.log('3. This will fix the ambiguous column references');
}

// Run the test
main().catch(console.error);