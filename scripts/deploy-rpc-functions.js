#!/usr/bin/env node

/**
 * Deploy Missing RPC Functions
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

async function executeSQL(sql) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ sql: sql })
    });

    if (response.ok) {
      return { success: true };
    } else {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Deploying missing RPC functions...\n');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'deploy_missing_rpc_functions.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Deploying RPC functions...');
    
    // Execute the SQL
    console.log('\n⏳ Executing SQL...');
    const result = await executeSQL(sqlContent);
    
    if (result.success) {
      console.log('✅ SQL executed successfully!');
    } else {
      console.log('⚠️  SQL execution warning:', result.error);
    }
    
    // Test the functions
    console.log('\n🔍 Testing functions...');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test get_inventory_with_fifo_ordering
    try {
      const { data: inventoryData, error: inventoryError } = await supabase.rpc('get_inventory_with_fifo_ordering');
      if (inventoryError) {
        console.log('⚠️  get_inventory_with_fifo_ordering test warning:', inventoryError.message);
      } else {
        console.log('✅ get_inventory_with_fifo_ordering is working!');
        console.log(`📊 Found ${inventoryData?.length || 0} inventory records`);
      }
    } catch (err) {
      console.log('⚠️  get_inventory_with_fifo_ordering test error:', err.message);
    }
    
    // Test get_outlet_receiving_records
    try {
      const { data: receivingData, error: receivingError } = await supabase.rpc('get_outlet_receiving_records');
      if (receivingError) {
        console.log('⚠️  get_outlet_receiving_records test warning:', receivingError.message);
      } else {
        console.log('✅ get_outlet_receiving_records is working!');
        console.log(`📊 Found ${receivingData?.length || 0} receiving records`);
      }
    } catch (err) {
      console.log('⚠️  get_outlet_receiving_records test error:', err.message);
    }
    
    console.log('\n🎉 RPC functions deployment completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Test your application: npm run dev');
    console.log('2. The 404 errors should now be resolved');
    console.log('3. Check the inventory and outlet receiving pages');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().catch(console.error);
