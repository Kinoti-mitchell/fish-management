/**
 * Test Script for Sorting Management Data
 * 
 * This script helps debug what data exists in the database
 * and why the sorting management component might not be showing data.
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
import { config } from 'dotenv';
config({ path: '../env.development' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Please check your .env file for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSortingData() {
  console.log('🔍 Testing Sorting Management Data...\n');

  try {
    // Test 1: Check if tables exist and have data
    console.log('📊 Table Record Counts:');
    
    const tables = [
      'warehouse_entries',
      'processing_records', 
      'sorting_batches',
      'sorting_results',
      'size_class_thresholds',
      'storage_locations'
    ];

    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          console.log(`  ❌ ${table}: Error - ${error.message}`);
        } else {
          console.log(`  ✅ ${table}: ${count || 0} records`);
        }
      } catch (err) {
        console.log(`  ❌ ${table}: Exception - ${err.message}`);
      }
    }

    console.log('\n🔍 Processing Records Ready for Sorting:');
    
    // Test 2: Check processing records that should be ready for sorting
    const { data: processingRecords, error: processingError } = await supabase
      .from('processing_records')
      .select(`
        id,
        processing_date,
        post_processing_weight,
        ready_for_dispatch_count,
        processing_code,
        fish_type,
        created_at
      `)
      .gt('post_processing_weight', 0)
      .order('processing_date', { ascending: false });

    if (processingError) {
      console.log(`  ❌ Error fetching processing records: ${processingError.message}`);
    } else {
      console.log(`  📋 Found ${processingRecords?.length || 0} processing records`);
      
      if (processingRecords && processingRecords.length > 0) {
        console.log('  📝 Sample records:');
        processingRecords.slice(0, 3).forEach((record, index) => {
          console.log(`    ${index + 1}. ID: ${record.id.slice(-8)} | Weight: ${record.post_processing_weight}kg | Pieces: ${record.ready_for_dispatch_count} | Date: ${record.processing_date}`);
        });
      }
    }

    console.log('\n🔍 Sorting Batches:');
    
    // Test 3: Check existing sorting batches
    const { data: sortingBatches, error: sortingError } = await supabase
      .from('sorting_batches')
      .select(`
        id,
        batch_number,
        status,
        total_weight_grams,
        total_pieces,
        sorting_date,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (sortingError) {
      console.log(`  ❌ Error fetching sorting batches: ${sortingError.message}`);
    } else {
      console.log(`  📦 Found ${sortingBatches?.length || 0} sorting batches`);
      
      if (sortingBatches && sortingBatches.length > 0) {
        console.log('  📝 Sample batches:');
        sortingBatches.slice(0, 3).forEach((batch, index) => {
          console.log(`    ${index + 1}. Batch: ${batch.batch_number} | Status: ${batch.status} | Weight: ${batch.total_weight_grams ? (batch.total_weight_grams / 1000).toFixed(1) : 0}kg`);
        });
      }
    }

    console.log('\n🔍 Size Class Thresholds:');
    
    // Test 4: Check size class thresholds
    const { data: thresholds, error: thresholdError } = await supabase
      .from('size_class_thresholds')
      .select('*')
      .eq('is_active', true)
      .order('class_number');

    if (thresholdError) {
      console.log(`  ❌ Error fetching size class thresholds: ${thresholdError.message}`);
    } else {
      console.log(`  📏 Found ${thresholds?.length || 0} active size class thresholds`);
      
      if (thresholds && thresholds.length > 0) {
        console.log('  📝 Sample thresholds:');
        thresholds.slice(0, 5).forEach((threshold) => {
          console.log(`    Class ${threshold.class_number}: ${threshold.min_weight_grams}g - ${threshold.max_weight_grams === 999999.99 ? '∞' : `${threshold.max_weight_grams}g`} (${threshold.description})`);
        });
      }
    }

    console.log('\n🔍 Storage Locations:');
    
    // Test 5: Check storage locations
    const { data: storageLocations, error: storageError } = await supabase
      .from('storage_locations')
      .select('*')
      .eq('status', 'active')
      .order('name');

    if (storageError) {
      console.log(`  ❌ Error fetching storage locations: ${storageError.message}`);
    } else {
      console.log(`  🏪 Found ${storageLocations?.length || 0} active storage locations`);
      
      if (storageLocations && storageLocations.length > 0) {
        console.log('  📝 Storage locations:');
        storageLocations.forEach((location) => {
          console.log(`    ${location.name}: ${location.capacity_kg}kg capacity, ${location.current_usage_kg || 0}kg used`);
        });
      }
    }

    console.log('\n📋 Summary:');
    console.log(`  • Processing Records: ${processingRecords?.length || 0}`);
    console.log(`  • Sorting Batches: ${sortingBatches?.length || 0}`);
    console.log(`  • Size Class Thresholds: ${thresholds?.length || 0}`);
    console.log(`  • Storage Locations: ${storageLocations?.length || 0}`);

    if ((processingRecords?.length || 0) === 0) {
      console.log('\n💡 Recommendation:');
      console.log('  No processing records found. You need to:');
      console.log('  1. Add warehouse entries (fish received from farmers)');
      console.log('  2. Process those entries in Processing Management');
      console.log('  3. Then they will appear in Sorting Management');
    } else if ((sortingBatches?.length || 0) === 0) {
      console.log('\n💡 Recommendation:');
      console.log('  Processing records exist but no sorting batches. You can:');
      console.log('  1. Use the "Sort Fish" button in Sorting Management');
      console.log('  2. Or use the sample data buttons in development mode');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testSortingData().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
