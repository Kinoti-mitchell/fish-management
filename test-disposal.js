// Simple test script to check disposal functionality
// Run this with: node test-disposal.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDisposalSystem() {
  console.log('🔍 Testing Disposal System...\n');

  try {
    // Test 1: Check if disposal tables exist
    console.log('1. Checking disposal tables...');
    
    const { data: disposalReasons, error: reasonsError } = await supabase
      .from('disposal_reasons')
      .select('count')
      .limit(1);
    
    if (reasonsError) {
      console.log('❌ disposal_reasons table error:', reasonsError.message);
    } else {
      console.log('✅ disposal_reasons table accessible');
    }

    const { data: disposalRecords, error: recordsError } = await supabase
      .from('disposal_records')
      .select('count')
      .limit(1);
    
    if (recordsError) {
      console.log('❌ disposal_records table error:', recordsError.message);
    } else {
      console.log('✅ disposal_records table accessible');
    }

    // Test 2: Check if sorting_results table exists (needed for disposal)
    console.log('\n2. Checking inventory data...');
    
    const { data: sortingResults, error: sortingError } = await supabase
      .from('sorting_results')
      .select('count')
      .limit(1);
    
    if (sortingError) {
      console.log('❌ sorting_results table error:', sortingError.message);
    } else {
      console.log('✅ sorting_results table accessible');
    }

    // Test 3: Check if disposal functions exist
    console.log('\n3. Testing disposal functions...');
    
    const { data: inventoryData, error: inventoryError } = await supabase
      .rpc('get_inventory_for_disposal', {
        p_days_old: 30,
        p_include_storage_issues: true
      });
    
    if (inventoryError) {
      console.log('❌ get_inventory_for_disposal function error:', inventoryError.message);
    } else {
      console.log('✅ get_inventory_for_disposal function works');
      console.log(`   Found ${inventoryData?.length || 0} items for disposal`);
    }

    // Test 4: Check storage locations
    console.log('\n4. Checking storage locations...');
    
    const { data: storageLocations, error: storageError } = await supabase
      .from('storage_locations')
      .select('name, status, location_type')
      .limit(5);
    
    if (storageError) {
      console.log('❌ storage_locations table error:', storageError.message);
    } else {
      console.log('✅ storage_locations table accessible');
      console.log(`   Found ${storageLocations?.length || 0} storage locations`);
      storageLocations?.forEach(loc => {
        console.log(`   - ${loc.name} (${loc.status})`);
      });
    }

    // Test 5: Check if we can create a disposal reason
    console.log('\n5. Testing disposal reason creation...');
    
    const { data: newReason, error: createError } = await supabase
      .from('disposal_reasons')
      .insert({
        name: 'Test Disposal Reason',
        description: 'Test reason for debugging'
      })
      .select()
      .single();
    
    if (createError) {
      console.log('❌ Cannot create disposal reason:', createError.message);
    } else {
      console.log('✅ Can create disposal reasons');
      
      // Clean up test data
      await supabase
        .from('disposal_reasons')
        .delete()
        .eq('id', newReason.id);
    }

    console.log('\n🎉 Disposal system test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDisposalSystem();

