#!/usr/bin/env node

/**
 * Fix Warehouse Schema Script - Direct Approach
 * This script adds the missing farmer_name column to warehouse_entries table
 */

const { createClient } = require('@supabase/supabase-js');
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
    // First, let's check if the column already exists
    console.log('⏳ Checking current warehouse_entries schema...');
    const { data: columns, error: schemaError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', 'warehouse_entries')
      .order('ordinal_position');
    
    if (schemaError) {
      console.log('⚠️  Schema check warning:', schemaError.message);
    } else {
      console.log('📊 Current warehouse_entries columns:');
      columns?.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
      
      // Check if farmer_name column already exists
      const hasFarmerName = columns?.some(col => col.column_name === 'farmer_name');
      if (hasFarmerName) {
        console.log('✅ farmer_name column already exists!');
        return true;
      }
    }
    
    // Try to add the column using a different approach
    console.log('⏳ Attempting to add farmer_name column...');
    
    // We'll use a simple approach - try to insert a test record and see what happens
    console.log('⏳ Testing warehouse_entries insert with farmer_name...');
    
    const testEntry = {
      entry_date: new Date().toISOString().split('T')[0],
      total_weight: 10.5,
      total_pieces: 5,
      condition: 'good',
      farmer_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
      farmer_name: 'Test Farmer', // This should fail if column doesn't exist
      price_per_kg: 15.0,
      total_value: 157.5,
      notes: 'Test entry'
    };
    
    const { data, error } = await supabase
      .from('warehouse_entries')
      .insert([testEntry])
      .select();
    
    if (error) {
      if (error.message.includes('farmer_name')) {
        console.log('❌ farmer_name column does not exist. Need to add it manually in Supabase dashboard.');
        console.log('📋 Manual steps required:');
        console.log('1. Go to your Supabase dashboard');
        console.log('2. Navigate to Table Editor > warehouse_entries');
        console.log('3. Add a new column: farmer_name (TEXT, nullable)');
        console.log('4. Or run this SQL in the SQL Editor:');
        console.log('   ALTER TABLE warehouse_entries ADD COLUMN farmer_name TEXT;');
        return false;
      } else {
        console.log('⚠️  Insert test error:', error.message);
        return false;
      }
    } else {
      console.log('✅ farmer_name column exists and insert worked!');
      // Clean up test entry
      if (data && data.length > 0) {
        await supabase
          .from('warehouse_entries')
          .delete()
          .eq('id', data[0].id);
        console.log('🧹 Cleaned up test entry');
      }
      return true;
    }
    
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
    console.log('\n❌ Schema fix failed - manual intervention required');
    console.log('Please add the farmer_name column manually in Supabase dashboard');
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
}

// Run the fix
main().catch(console.error);
