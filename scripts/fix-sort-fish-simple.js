#!/usr/bin/env node

/**
 * Simple Fix for Sort Fish Button Error
 * This script directly creates the necessary database tables and functions
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.log('Please ensure your .env file contains:');
  console.log('VITE_SUPABASE_URL=your_supabase_url');
  console.log('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key (or VITE_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testSortingTables() {
  console.log('🔍 Testing sorting tables...\n');
  
  try {
    // Test sorting_batches table
    console.log('Testing sorting_batches table...');
    const { data: batches, error: batchesError } = await supabase
      .from('sorting_batches')
      .select('id')
      .limit(1);
    
    if (batchesError) {
      console.log('❌ sorting_batches table error:', batchesError.message);
      return false;
    } else {
      console.log('✅ sorting_batches table exists');
    }
    
    // Test storage_locations table
    console.log('Testing storage_locations table...');
    const { data: locations, error: locationsError } = await supabase
      .from('storage_locations')
      .select('id')
      .limit(1);
    
    if (locationsError) {
      console.log('❌ storage_locations table error:', locationsError.message);
      return false;
    } else {
      console.log('✅ storage_locations table exists');
    }
    
    // Test processing_records table
    console.log('Testing processing_records table...');
    const { data: records, error: recordsError } = await supabase
      .from('processing_records')
      .select('id')
      .limit(1);
    
    if (recordsError) {
      console.log('❌ processing_records table error:', recordsError.message);
      return false;
    } else {
      console.log('✅ processing_records table exists');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function createStorageLocations() {
  console.log('🏗️  Creating storage locations...\n');
  
  try {
    // Check if storage locations already exist
    const { data: existing, error: checkError } = await supabase
      .from('storage_locations')
      .select('id')
      .limit(1);
    
    if (checkError && checkError.message.includes('relation') && checkError.message.includes('does not exist')) {
      console.log('❌ storage_locations table does not exist');
      return false;
    }
    
    if (existing && existing.length > 0) {
      console.log('✅ Storage locations already exist');
      return true;
    }
    
    // Create default storage locations
    const locations = [
      { id: '11111111-1111-1111-1111-111111111111', name: 'Cold Storage A', location_type: 'cold_storage', capacity_kg: 2000, status: 'active' },
      { id: '22222222-2222-2222-2222-222222222222', name: 'Cold Storage B', location_type: 'cold_storage', capacity_kg: 1500, status: 'active' },
      { id: '33333333-3333-3333-3333-333333333333', name: 'Freezer Unit 1', location_type: 'freezer', capacity_kg: 1000, status: 'active' },
      { id: '44444444-4444-4444-4444-444444444444', name: 'Processing Area 1', location_type: 'processing', capacity_kg: 500, status: 'active' },
      { id: '55555555-5555-5555-5555-555555555555', name: 'Processing Area 2', location_type: 'processing', capacity_kg: 500, status: 'active' }
    ];
    
    const { data, error } = await supabase
      .from('storage_locations')
      .insert(locations);
    
    if (error) {
      console.error('❌ Error creating storage locations:', error.message);
      return false;
    } else {
      console.log('✅ Storage locations created successfully');
      return true;
    }
  } catch (error) {
    console.error('❌ Failed to create storage locations:', error.message);
    return false;
  }
}

async function testSortFishButton() {
  console.log('🧪 Testing Sort Fish Button functionality...\n');
  
  try {
    // Test if we can query processing records
    console.log('Testing processing records query...');
    const { data: records, error: recordsError } = await supabase
      .from('processing_records')
      .select('id, processing_date, post_processing_weight, ready_for_dispatch_count')
      .limit(5);
    
    if (recordsError) {
      console.error('❌ Processing records query error:', recordsError.message);
      return false;
    } else {
      console.log(`✅ Processing records query successful (${records?.length || 0} records found)`);
    }
    
    // Test if we can query sorting batches
    console.log('Testing sorting batches query...');
    const { data: batches, error: batchesError } = await supabase
      .from('sorting_batches')
      .select('id, batch_number, status')
      .limit(5);
    
    if (batchesError) {
      console.error('❌ Sorting batches query error:', batchesError.message);
      return false;
    } else {
      console.log(`✅ Sorting batches query successful (${batches?.length || 0} batches found)`);
    }
    
    // Test if we can query storage locations
    console.log('Testing storage locations query...');
    const { data: locations, error: locationsError } = await supabase
      .from('storage_locations')
      .select('id, name, status')
      .limit(5);
    
    if (locationsError) {
      console.error('❌ Storage locations query error:', locationsError.message);
      return false;
    } else {
      console.log(`✅ Storage locations query successful (${locations?.length || 0} locations found)`);
    }
    
    console.log('\n🎉 All tests passed! Sort Fish Button should work correctly now.');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🐟 Rio Fish Farm - Simple Sort Fish Button Fix');
  console.log('===============================================\n');
  
  // Test existing tables
  const tablesExist = await testSortingTables();
  
  if (!tablesExist) {
    console.log('\n❌ Required database tables are missing.');
    console.log('Please run the database migration scripts first:');
    console.log('1. Check the db/ folder for migration scripts');
    console.log('2. Run the appropriate SQL scripts in your Supabase dashboard');
    console.log('3. Or contact your database administrator');
    return;
  }
  
  // Create storage locations if needed
  await createStorageLocations();
  
  // Test the functionality
  await testSortFishButton();
  
  console.log('\n🚀 Next Steps:');
  console.log('1. Refresh your browser');
  console.log('2. Try clicking the "Sort Fish" button again');
  console.log('3. The error should be resolved');
  console.log('4. If you still see errors, check the browser console for specific error messages');
  console.log('\n💡 If the error persists, the issue might be:');
  console.log('- Missing database tables (run migration scripts)');
  console.log('- RLS (Row Level Security) policies blocking access');
  console.log('- Authentication issues (try logging out and back in)');
  console.log('- Network connectivity issues');
}

// Run the fix
main().catch(console.error);
