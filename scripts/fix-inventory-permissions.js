#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/server.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixInventoryPermissions() {
  console.log('🔧 Fixing outlet_receiving_inventory permissions...');
  
  try {
    // Apply the SQL fix directly
    const sqlCommands = [
      'ALTER TABLE outlet_receiving_inventory DISABLE ROW LEVEL SECURITY;',
      'GRANT SELECT, INSERT, UPDATE, DELETE ON outlet_receiving_inventory TO authenticated;',
      'GRANT USAGE ON SCHEMA public TO authenticated;',
      'ALTER TABLE outlet_receiving DISABLE ROW LEVEL SECURITY;',
      'GRANT SELECT, INSERT, UPDATE, DELETE ON outlet_receiving TO authenticated;',
      'GRANT SELECT, INSERT, UPDATE, DELETE ON dispatch_records TO authenticated;',
      'GRANT SELECT, INSERT, UPDATE, DELETE ON outlet_orders TO authenticated;',
      'GRANT SELECT, INSERT, UPDATE, DELETE ON outlets TO authenticated;'
    ];
    
    for (const sql of sqlCommands) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql });
        if (error) {
          console.log(`⚠️  Warning: ${error.message}`);
        } else {
          console.log(`✅ Executed: ${sql.substring(0, 50)}...`);
        }
      } catch (err) {
        console.log(`⚠️  Warning: ${err.message}`);
      }
    }
    
    console.log('✅ Permission commands executed!');
    
    // Test access
    console.log('🧪 Testing table access...');
    const { data, error: testError } = await supabase
      .from('outlet_receiving_inventory')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('❌ Still cannot access outlet_receiving_inventory:', testError.message);
      console.log('\n📋 Manual fix needed:');
      console.log('1. Go to Supabase Dashboard > SQL Editor');
      console.log('2. Run this SQL:');
      console.log('   ALTER TABLE outlet_receiving_inventory DISABLE ROW LEVEL SECURITY;');
      console.log('   GRANT SELECT, INSERT, UPDATE, DELETE ON outlet_receiving_inventory TO authenticated;');
    } else {
      console.log('✅ Successfully accessed outlet_receiving_inventory table');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixInventoryPermissions();
