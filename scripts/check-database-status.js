/**
 * Database Status Check Script
 * 
 * This script checks what tables and functions exist in the database
 * to help diagnose setup issues.
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDatabaseStatus() {
  console.log('🔍 Checking Database Status...\n');
  
  try {
    // Check existing tables
    console.log('📋 Checking existing tables...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');
    
    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError.message);
    } else {
      console.log('✅ Found tables:');
      tables?.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
    }
    
    // Check for sorting-related tables specifically
    console.log('\n🔍 Checking for sorting module tables...');
    const sortingTables = ['size_class_thresholds', 'sorting_batches', 'sorted_fish_items', 'sorting_results'];
    
    for (const tableName of sortingTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`   ❌ ${tableName}: ${error.message}`);
        } else {
          console.log(`   ✅ ${tableName}: Table exists`);
        }
      } catch (err) {
        console.log(`   ❌ ${tableName}: ${err.message}`);
      }
    }
    
    // Check for existing processing_records table
    console.log('\n🔍 Checking for processing_records table...');
    try {
      const { data, error } = await supabase
        .from('processing_records')
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`   ❌ processing_records: ${error.message}`);
      } else {
        console.log(`   ✅ processing_records: Table exists`);
      }
    } catch (err) {
      console.log(`   ❌ processing_records: ${err.message}`);
    }
    
    // Check for inventory table
    console.log('\n🔍 Checking for inventory table...');
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`   ❌ inventory: ${error.message}`);
      } else {
        console.log(`   ✅ inventory: Table exists`);
      }
    } catch (err) {
      console.log(`   ❌ inventory: ${err.message}`);
    }
    
    console.log('\n📝 Summary:');
    console.log('   If sorting tables are missing, you need to run the SQL files manually:');
    console.log('   1. Copy contents of db/create_sorting_module.sql to Supabase SQL Editor');
    console.log('   2. Copy contents of db/modify_inventory_for_sorting.sql to Supabase SQL Editor');
    console.log('   3. Run both SQL scripts in your Supabase dashboard');
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  }
}

// Run the check
if (require.main === module) {
  checkDatabaseStatus()
    .then(() => {
      console.log('\n✨ Database status check completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Database check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkDatabaseStatus };
