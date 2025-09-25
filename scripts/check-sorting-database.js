/**
 * Check Sorting Database Setup
 * 
 * This script checks if the sorting module database tables and functions are properly set up.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseSetup() {
  console.log('🔍 Checking Sorting Database Setup...\n');

  // Check if tables exist
  const tables = [
    'size_class_thresholds',
    'sorting_batches', 
    'sorted_fish_items',
    'sorting_results',
    'inventory',
    'inventory_entries'
  ];

  console.log('📋 Checking required tables...');
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`   ❌ ${table}: ${error.message}`);
      } else {
        console.log(`   ✅ ${table}: Table exists`);
      }
    } catch (err) {
      console.log(`   ❌ ${table}: ${err.message}`);
    }
  }

  // Check if functions exist
  console.log('\n🔧 Checking required functions...');
  const functions = [
    'get_size_class_for_weight',
    'create_sorting_batch',
    'add_stock_from_sorting',
    'get_inventory_summary_with_sorting',
    'validate_sorting_batch_for_inventory'
  ];

  for (const func of functions) {
    try {
      const { data, error } = await supabase.rpc(func, {});
      
      if (error) {
        console.log(`   ❌ ${func}: ${error.message}`);
      } else {
        console.log(`   ✅ ${func}: Function exists`);
      }
    } catch (err) {
      console.log(`   ❌ ${func}: ${err.message}`);
    }
  }

  // Check if processing_records has ready_for_sorting column
  console.log('\n📊 Checking processing_records table structure...');
  try {
    const { data, error } = await supabase
      .from('processing_records')
      .select('ready_for_sorting')
      .limit(1);
    
    if (error) {
      console.log(`   ❌ ready_for_sorting column: ${error.message}`);
    } else {
      console.log(`   ✅ ready_for_sorting column: Column exists`);
    }
  } catch (err) {
    console.log(`   ❌ ready_for_sorting column: ${err.message}`);
  }

  // Check if size class thresholds have default data
  console.log('\n📏 Checking size class thresholds...');
  try {
    const { data, error } = await supabase
      .from('size_class_thresholds')
      .select('*')
      .order('class_number');
    
    if (error) {
      console.log(`   ❌ Size class thresholds: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(`   ✅ Size class thresholds: ${data.length} classes configured`);
      console.log('   📋 Classes:');
      data.forEach(threshold => {
        console.log(`      Class ${threshold.class_number}: ${threshold.min_weight_grams}g - ${threshold.max_weight_grams}g (${threshold.description})`);
      });
    } else {
      console.log(`   ⚠️  Size class thresholds: No data found`);
    }
  } catch (err) {
    console.log(`   ❌ Size class thresholds: ${err.message}`);
  }

  console.log('\n✨ Database setup check completed!');
  
  console.log('\n📝 Next Steps:');
  console.log('1. If tables are missing, run the SQL files in your Supabase dashboard:');
  console.log('   - db/create_sorting_module.sql');
  console.log('   - db/modify_inventory_for_sorting.sql');
  console.log('2. If functions are missing, they should be created by the SQL files above');
  console.log('3. If ready_for_sorting column is missing, add it to processing_records table');
  console.log('4. If size class thresholds are empty, they should be populated by the SQL files');
}

checkDatabaseSetup().catch(console.error);
