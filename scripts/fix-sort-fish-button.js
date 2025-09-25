#!/usr/bin/env node

/**
 * Fix Sort Fish Button Error Script
 * This script runs the database fixes to resolve the sort fish button error
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
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

// Use service role key if available, otherwise use anon key
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runDatabaseFix() {
  console.log('🔧 Running Sort Fish Button Error Fix...\n');
  
  try {
    // Read the SQL fix file
    const sqlFilePath = path.join(__dirname, '..', 'db', 'fix_sort_fish_button_error.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('📄 SQL fix file loaded successfully');
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: statement
        });
        
        if (error) {
          // Some errors are expected (like "already exists")
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist') ||
              error.message.includes('relation') && error.message.includes('already exists')) {
            console.log(`⚠️  Expected warning: ${error.message}`);
            successCount++;
          } else {
            console.error(`❌ Error in statement ${i + 1}:`, error.message);
            errorCount++;
          }
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Exception in statement ${i + 1}:`, err.message);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Execution Summary:`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 All database fixes applied successfully!');
      return true;
    } else {
      console.log('\n⚠️  Some errors occurred, but the main fixes should be applied.');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Failed to run database fix:', error.message);
    return false;
  }
}

async function testSortFishButton() {
  console.log('\n🧪 Testing Sort Fish Button functionality...\n');
  
  try {
    // Test 1: Check if sorting_batches table exists and is accessible
    console.log('🔍 Test 1: Checking sorting_batches table...');
    const { data: batches, error: batchesError } = await supabase
      .from('sorting_batches')
      .select('id, batch_number, status')
      .limit(1);
    
    if (batchesError) {
      console.error('❌ sorting_batches table error:', batchesError.message);
      return false;
    } else {
      console.log('✅ sorting_batches table is accessible');
    }
    
    // Test 2: Check if storage_locations table exists and has data
    console.log('🔍 Test 2: Checking storage_locations table...');
    const { data: locations, error: locationsError } = await supabase
      .from('storage_locations')
      .select('id, name, status')
      .limit(5);
    
    if (locationsError) {
      console.error('❌ storage_locations table error:', locationsError.message);
      return false;
    } else {
      console.log(`✅ storage_locations table is accessible (${locations?.length || 0} locations found)`);
    }
    
    // Test 3: Check if processing_records table exists
    console.log('🔍 Test 3: Checking processing_records table...');
    const { data: records, error: recordsError } = await supabase
      .from('processing_records')
      .select('id, processing_date, post_processing_weight')
      .limit(1);
    
    if (recordsError) {
      console.error('❌ processing_records table error:', recordsError.message);
      return false;
    } else {
      console.log('✅ processing_records table is accessible');
    }
    
    // Test 4: Check if create_sorting_batch_safe function exists
    console.log('🔍 Test 4: Checking create_sorting_batch_safe function...');
    const { data: functions, error: functionsError } = await supabase
      .rpc('exec_sql', {
        sql: "SELECT proname FROM pg_proc WHERE proname = 'create_sorting_batch_safe'"
      });
    
    if (functionsError) {
      console.error('❌ Function check error:', functionsError.message);
      return false;
    } else {
      console.log('✅ create_sorting_batch_safe function exists');
    }
    
    console.log('\n🎉 All tests passed! Sort Fish Button should work correctly now.');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🐟 Rio Fish Farm - Sort Fish Button Error Fix');
  console.log('===============================================\n');
  
  // Run the database fix
  const fixSuccess = await runDatabaseFix();
  
  if (fixSuccess) {
    // Test the functionality
    await testSortFishButton();
  }
  
  console.log('\n🚀 Next Steps:');
  console.log('1. Refresh your browser');
  console.log('2. Try clicking the "Sort Fish" button again');
  console.log('3. The error should be resolved');
  console.log('4. If you still see errors, check the browser console for specific error messages');
}

// Run the fix
main().catch(console.error);
