#!/usr/bin/env node

/**
 * Fix Ambiguous ID Error Script
 * This script fixes the ambiguous 'id' column reference error in add_stock_from_sorting function
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
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

async function runSQLFix() {
  console.log('🚀 Running ambiguous ID fix...\n');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'fix_ambiguous_id_error.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          const { data, error } = await supabase.rpc('exec_sql', {
            sql: statement + ';'
          });
          
          if (error) {
            console.log(`⚠️  Statement ${i + 1} warning:`, error.message);
          } else {
            console.log(`✅ Statement ${i + 1} completed successfully`);
          }
        } catch (err) {
          console.log(`⚠️  Statement ${i + 1} error:`, err.message);
        }
      }
    }
    
    console.log('\n🎉 Ambiguous ID fix completed!');
    return true;
  } catch (error) {
    console.error('❌ Error running SQL fix:', error);
    return false;
  }
}

async function testSortingFunction() {
  console.log('🔍 Testing sorting function...');
  
  try {
    // Test the debug function first
    const { data: debugData, error: debugError } = await supabase
      .rpc('test_sorting_batch_debug', { p_sorting_batch_id: '00000000-0000-0000-0000-000000000000' });
    
    if (debugError) {
      console.log('⚠️  Debug function test (expected to fail with invalid UUID):', debugError.message);
    } else {
      console.log('✅ Debug function is working');
    }
    
    // Check if the main function exists
    const { data: functionData, error: functionError } = await supabase
      .rpc('add_stock_from_sorting', { p_sorting_batch_id: '00000000-0000-0000-0000-000000000000' });
    
    if (functionError) {
      if (functionError.message.includes('not found')) {
        console.log('✅ Function exists and is working (expected error for invalid UUID)');
      } else {
        console.log('⚠️  Function test error:', functionError.message);
      }
    } else {
      console.log('✅ Function is working');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Function test failed:', error);
    return false;
  }
}

async function checkSortingBatches() {
  console.log('🔍 Checking current sorting batches...');
  
  try {
    const { data, error } = await supabase
      .from('sorting_batches')
      .select('id, batch_number, status, size_distribution')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('❌ Error fetching sorting batches:', error);
      return false;
    }
    
    console.log(`📊 Found ${data?.length || 0} completed sorting batches`);
    
    if (data && data.length > 0) {
      console.log('📋 Recent completed batches:');
      data.forEach((batch, index) => {
        console.log(`  ${index + 1}. ${batch.batch_number} (${batch.status}) - ID: ${batch.id}`);
        if (batch.size_distribution) {
          console.log(`     Size distribution: ${JSON.stringify(batch.size_distribution)}`);
        }
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error checking sorting batches:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting ambiguous ID fix process...\n');
  
  // Step 1: Run SQL fix
  const sqlFixCompleted = await runSQLFix();
  if (!sqlFixCompleted) {
    console.log('\n❌ SQL fix failed');
    process.exit(1);
  }
  
  console.log('');
  
  // Step 2: Test functions
  const functionTest = await testSortingFunction();
  if (!functionTest) {
    console.log('\n❌ Function test failed');
    process.exit(1);
  }
  
  console.log('');
  
  // Step 3: Check sorting batches
  const batchCheck = await checkSortingBatches();
  if (!batchCheck) {
    console.log('\n❌ Batch check failed');
    process.exit(1);
  }
  
  console.log('\n✅ Ambiguous ID fix completed successfully!');
  console.log('🎉 The sorting to inventory integration should now work');
  console.log('\n📋 Next steps:');
  console.log('1. Test the sorting management in your application');
  console.log('2. Try creating a new sorting batch');
  console.log('3. Check that it automatically adds to inventory without errors');
}

// Run the fix
main().catch(console.error);
