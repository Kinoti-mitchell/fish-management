const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/server.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDatabaseAccess() {
  console.log('🔍 Testing database access...');

  const tables = [
    'farmers',
    'warehouse_entries', 
    'processing_records',
    'sorting_batches',
    'inventory',
    'storage_locations',
    'profiles'
  ];

  for (const table of tables) {
    try {
      console.log(`⏳ Testing ${table}...`);
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.error(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: Access granted`);
      }
    } catch (err) {
      console.error(`❌ ${table}: ${err.message}`);
    }
  }

  // Test warehouse_entries specifically for entry codes
  try {
    console.log('\n⏳ Testing warehouse_entries with entry_code...');
    const { data, error } = await supabase
      .from('warehouse_entries')
      .select('id, entry_code')
      .limit(5);

    if (error) {
      console.error(`❌ warehouse_entries entry_code test: ${error.message}`);
    } else {
      console.log(`✅ warehouse_entries entry_code test: Found ${data?.length || 0} entries`);
      if (data && data.length > 0) {
        console.log('Sample entry codes:', data.map(d => d.entry_code).filter(Boolean));
      }
    }
  } catch (err) {
    console.error(`❌ warehouse_entries entry_code test: ${err.message}`);
  }
}

testDatabaseAccess();
