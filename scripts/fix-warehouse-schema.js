#!/usr/bin/env node

/**
 * Fix Warehouse Schema Script
 * This script adds the missing farmer_name column to warehouse_entries table
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

async function fixWarehouseSchema() {
  console.log('🚀 Fixing warehouse_entries schema...\n');
  
  try {
    // Add farmer_name column
    console.log('⏳ Adding farmer_name column to warehouse_entries...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE warehouse_entries ADD COLUMN IF NOT EXISTS farmer_name TEXT;'
    });
    
    if (alterError) {
      console.log('⚠️  Alter table warning:', alterError.message);
    } else {
      console.log('✅ farmer_name column added successfully');
    }
    
    // Update existing records to populate farmer_name from farmers table
    console.log('⏳ Updating existing records with farmer names...');
    const { error: updateError } = await supabase.rpc('exec_sql', {
      sql: `UPDATE warehouse_entries 
            SET farmer_name = f.name
            FROM farmers f 
            WHERE warehouse_entries.farmer_id = f.id 
            AND warehouse_entries.farmer_name IS NULL;`
    });
    
    if (updateError) {
      console.log('⚠️  Update records warning:', updateError.message);
    } else {
      console.log('✅ Existing records updated with farmer names');
    }
    
    // Verify the schema
    console.log('⏳ Verifying schema...');
    const { data: columns, error: schemaError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', 'warehouse_entries')
      .order('ordinal_position');
    
    if (schemaError) {
      console.log('⚠️  Schema verification warning:', schemaError.message);
    } else {
      console.log('✅ Schema verification completed');
      console.log('📊 warehouse_entries columns:');
      columns?.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }
    
    console.log('\n🎉 Warehouse schema fix completed!');
    return true;
  } catch (error) {
    console.error('❌ Error fixing warehouse schema:', error);
    return false;
  }
}

async function testWarehouseEntries() {
  console.log('🔍 Testing warehouse_entries table...');
  
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('warehouse_entries')
      .select('id, entry_date, total_weight, farmer_name')
      .limit(1);
    
    if (error) {
      console.error('❌ Warehouse entries test failed:', error);
      return false;
    }
    
    console.log('✅ Warehouse entries table accessible');
    console.log(`📊 Found ${data?.length || 0} warehouse entries`);
    
    if (data && data.length > 0) {
      console.log('📦 Sample warehouse entry:', data[0]);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Warehouse entries test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting warehouse schema fix...\n');
  
  // Step 1: Fix schema
  const schemaFixCompleted = await fixWarehouseSchema();
  if (!schemaFixCompleted) {
    console.log('\n❌ Schema fix failed');
    process.exit(1);
  }
  
  console.log('');
  
  // Step 2: Test warehouse entries
  const warehouseTest = await testWarehouseEntries();
  if (!warehouseTest) {
    console.log('\n❌ Warehouse entries test failed');
    process.exit(1);
  }
  
  console.log('\n✅ Warehouse schema fix completed successfully!');
  console.log('🎉 Warehouse entries should now work without errors');
  console.log('\n📋 Next steps:');
  console.log('1. Test your application: npm run dev');
  console.log('2. Try creating a warehouse entry');
  console.log('3. Check the browser console for any remaining errors');
}

// Run the fix
main().catch(console.error);
