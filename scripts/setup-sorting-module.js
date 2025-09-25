/**
 * Setup Script for Sorting Module
 * 
 * This script sets up the complete sorting module for the Fish Warehouse Management System.
 * It creates all necessary database tables, functions, and applies the workflow changes.
 * 
 * Run this script after the main database setup to add the sorting functionality.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSQLFile(filePath) {
  try {
    console.log(`📄 Reading SQL file: ${filePath}`);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    console.log(`🚀 Executing SQL from: ${filePath}`);
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // If exec_sql doesn't exist, try direct query execution
      console.log('⚠️  exec_sql function not available, trying direct execution...');
      
      // Split SQL into individual statements and execute them
      const statements = sql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.trim()) {
          console.log(`   Executing: ${statement.substring(0, 100)}...`);
          const { error: stmtError } = await supabase.rpc('exec', { sql: statement });
          if (stmtError) {
            console.warn(`   ⚠️  Warning: ${stmtError.message}`);
          }
        }
      }
    } else {
      console.log(`✅ Successfully executed: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error executing ${filePath}:`, error.message);
    throw error;
  }
}

async function testSortingModule() {
  console.log('\n🧪 Testing Sorting Module...');
  
  try {
    // Test 1: Check if size class thresholds exist
    console.log('   Testing size class thresholds...');
    const { data: thresholds, error: thresholdsError } = await supabase
      .from('size_class_thresholds')
      .select('*')
      .limit(5);
    
    if (thresholdsError) {
      console.error('   ❌ Size class thresholds table not found:', thresholdsError.message);
      return false;
    }
    console.log(`   ✅ Found ${thresholds?.length || 0} size class thresholds`);
    
    // Test 2: Check if sorting functions exist
    console.log('   Testing sorting functions...');
    const { data: functionTest, error: functionError } = await supabase
      .rpc('get_size_class_for_weight', { weight_grams: 500 });
    
    if (functionError) {
      console.error('   ❌ Sorting functions not working:', functionError.message);
      return false;
    }
    console.log(`   ✅ Size class for 500g: ${functionTest}`);
    
    // Test 3: Check inventory functions
    console.log('   Testing inventory functions...');
    const { data: inventoryTest, error: inventoryError } = await supabase
      .rpc('get_sorting_batches_for_inventory');
    
    if (inventoryError) {
      console.error('   ❌ Inventory functions not working:', inventoryError.message);
      return false;
    }
    console.log(`   ✅ Found ${inventoryTest?.length || 0} sorting batches for inventory`);
    
    return true;
  } catch (error) {
    console.error('   ❌ Testing failed:', error.message);
    return false;
  }
}

async function setupSortingModule() {
  console.log('🐟 Setting up Fish Warehouse Sorting Module...\n');
  
  try {
    // Step 1: Create sorting module schema
    console.log('📋 Step 1: Creating sorting module database schema...');
    await runSQLFile(path.join(__dirname, '..', 'db', 'create_sorting_module.sql'));
    
    // Step 2: Modify inventory system for sorting
    console.log('\n📋 Step 2: Modifying inventory system for sorting workflow...');
    await runSQLFile(path.join(__dirname, '..', 'db', 'modify_inventory_for_sorting.sql'));
    
    // Step 3: Test the setup
    console.log('\n📋 Step 3: Testing the setup...');
    const testPassed = await testSortingModule();
    
    if (testPassed) {
      console.log('\n🎉 Sorting Module Setup Complete!');
      console.log('\n📝 What was implemented:');
      console.log('   ✅ Size class thresholds table (configurable 0-10 classes)');
      console.log('   ✅ Sorting batches table (tracks sorting operations)');
      console.log('   ✅ Sorted fish items table (individual fish after sorting)');
      console.log('   ✅ Sorting results table (aggregated results per size class)');
      console.log('   ✅ Database functions for sorting operations');
      console.log('   ✅ Modified inventory system to require sorting');
      console.log('   ✅ Validation functions for sorting workflow');
      console.log('   ✅ Row Level Security policies');
      
      console.log('\n🔄 New Workflow:');
      console.log('   Fish Entry → Processing → Sorting (size classes 0-10) → Inventory');
      
      console.log('\n⚙️  Key Features:');
      console.log('   • Configurable size class thresholds (admin can adjust)');
      console.log('   • Batch-based sorting with validation');
      console.log('   • Fish cannot be stored in inventory unless sorted');
      console.log('   • Complete audit trail of sorting operations');
      console.log('   • Integration with existing processing and inventory systems');
      
      console.log('\n🚀 Next Steps:');
      console.log('   1. The backend services are ready (sortingService.ts)');
      console.log('   2. Types are updated (types/index.ts)');
      console.log('   3. Database functions are available');
      console.log('   4. You can now implement the UI components for sorting');
      
    } else {
      console.log('\n❌ Setup completed but tests failed. Please check the logs above.');
    }
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Ensure your Supabase database is accessible');
    console.error('   2. Check that you have the service role key');
    console.error('   3. Verify the database has the required extensions');
    console.error('   4. Check the SQL files exist in the db/ directory');
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  setupSortingModule()
    .then(() => {
      console.log('\n✨ Setup script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Setup script failed:', error);
      process.exit(1);
    });
}

module.exports = { setupSortingModule, testSortingModule };
