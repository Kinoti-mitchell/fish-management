#!/usr/bin/env node

/**
 * Fix Sorting Batches Relationship Script
 * This script fixes the relationship between sorting_batches and profiles tables
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

async function runRelationshipFix() {
  console.log('🚀 Fixing sorting_batches relationship to profiles...\n');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'fix_sorting_batches_profiles_relationship.sql');
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
            if (data) {
              console.log(`📊 Result:`, data);
            }
          }
        } catch (err) {
          console.log(`⚠️  Statement ${i + 1} error:`, err.message);
        }
      }
    }
    
    console.log('\n🎉 Relationship fix completed!');
    return true;
  } catch (error) {
    console.error('❌ Error running relationship fix:', error);
    return false;
  }
}

async function testSortingBatchesQuery() {
  console.log('🔍 Testing sorting batches query...');
  
  try {
    // Test the exact query that was failing
    const { data, error } = await supabase
      .from('sorting_batches')
      .select(`
        *,
        processing_record:processing_records(
          id,
          processing_date,
          post_processing_weight,
          ready_for_dispatch_count,
          processing_code,
          fish_type,
          grading_results,
          final_value,
          processing_yield,
          processing_waste,
          size_distribution,
          total_pieces,
          warehouse_entry:warehouse_entries(
            id,
            farmer_id,
            farmer:farmers(
              id,
              name,
              phone,
              location,
              rating
            )
          )
        ),
        sorted_by_user:profiles(
          id,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('❌ Sorting batches query failed:', error);
      return false;
    }
    
    console.log('✅ Sorting batches query successful');
    console.log(`📊 Found ${data?.length || 0} sorting batches`);
    
    if (data && data.length > 0) {
      console.log('📋 Sample sorting batch:', {
        id: data[0].id,
        status: data[0].status,
        sorted_by_user: data[0].sorted_by_user
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Sorting batches query test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting sorting relationship fix process...\n');
  
  // Step 1: Run relationship fix
  const fixCompleted = await runRelationshipFix();
  if (!fixCompleted) {
    console.log('\n❌ Relationship fix failed');
    process.exit(1);
  }
  
  console.log('');
  
  // Step 2: Test the query that was failing
  const queryTest = await testSortingBatchesQuery();
  if (!queryTest) {
    console.log('\n❌ Query test failed');
    process.exit(1);
  }
  
  console.log('\n✅ Sorting relationship fix completed successfully!');
  console.log('🎉 The sorting management page should now work without errors');
  console.log('\n📋 Next steps:');
  console.log('1. Test your application: npm run dev');
  console.log('2. Navigate to the sorting management page');
  console.log('3. Check that sorting batches load without errors');
}

// Run the fix
main().catch(console.error);
