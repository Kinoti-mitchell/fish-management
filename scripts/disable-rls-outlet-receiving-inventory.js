const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: 'server/server.env' });

// Initialize Supabase client with service role key
const supabaseUrl = 'https://pgpazwlejhysxabtkifz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fs.readFileSync('SUPABASE_SERVICE_ROLE_KEY', 'utf8').trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function disableRLSOnOutletReceivingInventory() {
  try {
    console.log('🔧 Disabling RLS on outlet_receiving_inventory table...');
    
    // First, let's check if the table exists and what its current RLS status is
    const { data: tableInfo, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name, is_insertable_into')
      .eq('table_name', 'outlet_receiving_inventory')
      .eq('table_schema', 'public');
    
    if (tableError) {
      console.log('⚠️  Could not check table info:', tableError.message);
    } else {
      console.log('📋 Table info:', tableInfo);
    }
    
    // Try to disable RLS using a direct SQL approach
    // Since we can't use exec, let's try using the SQL editor approach
    console.log('🚫 Attempting to disable RLS...');
    
    // Let's try a different approach - check if we can access the table with service role
    const { data: testData, error: testError } = await supabase
      .from('outlet_receiving_inventory')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.log('❌ Still getting permission error:', testError.message);
      console.log('💡 The table likely has RLS enabled and needs to be disabled via SQL editor');
      console.log('📝 Please run this SQL in your Supabase SQL editor:');
      console.log('');
      console.log('ALTER TABLE outlet_receiving_inventory DISABLE ROW LEVEL SECURITY;');
      console.log('GRANT SELECT, INSERT, UPDATE, DELETE ON outlet_receiving_inventory TO authenticated;');
      console.log('');
    } else {
      console.log('✅ Success! RLS is already disabled or table is accessible');
      console.log('📊 Test data:', testData);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function main() {
  console.log('🚀 Starting RLS disable process for outlet_receiving_inventory...\n');
  await disableRLSOnOutletReceivingInventory();
  console.log('\n✅ Process completed');
}

main().catch(console.error);
