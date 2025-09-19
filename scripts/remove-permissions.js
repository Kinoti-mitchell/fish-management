const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/server.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function removePermissions() {
  console.log('🚀 Starting permissions removal...');

  try {
    // Disable RLS on all tables
    const disableRLSQueries = [
      'ALTER TABLE IF EXISTS farmers DISABLE ROW LEVEL SECURITY;',
      'ALTER TABLE IF EXISTS warehouse_entries DISABLE ROW LEVEL SECURITY;',
      'ALTER TABLE IF EXISTS processing_records DISABLE ROW LEVEL SECURITY;',
      'ALTER TABLE IF EXISTS sorting_batches DISABLE ROW LEVEL SECURITY;',
      'ALTER TABLE IF EXISTS sorting_results DISABLE ROW LEVEL SECURITY;',
      'ALTER TABLE IF EXISTS inventory DISABLE ROW LEVEL SECURITY;',
      'ALTER TABLE IF EXISTS inventory_entries DISABLE ROW LEVEL SECURITY;',
      'ALTER TABLE IF EXISTS storage_locations DISABLE ROW LEVEL SECURITY;',
      'ALTER TABLE IF EXISTS size_class_thresholds DISABLE ROW LEVEL SECURITY;',
      'ALTER TABLE IF EXISTS sorted_fish_items DISABLE ROW LEVEL SECURITY;',
      'ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;',
      'ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;'
    ];

    for (const query of disableRLSQueries) {
      console.log(`⏳ Executing: ${query}`);
      const { error } = await supabase.rpc('exec_sql', { sql: query });
      if (error) {
        console.warn(`⚠️  Warning: ${error.message}`);
      } else {
        console.log('✅ Success');
      }
    }

    // Grant permissions
    const grantQueries = [
      'GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;',
      'GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;',
      'GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;',
      'GRANT USAGE ON SCHEMA public TO anon;',
      'GRANT USAGE ON SCHEMA public TO authenticated;',
      'GRANT USAGE ON SCHEMA public TO service_role;',
      'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;',
      'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;',
      'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;',
      'GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;',
      'GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;',
      'GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;'
    ];

    for (const query of grantQueries) {
      console.log(`⏳ Executing: ${query}`);
      const { error } = await supabase.rpc('exec_sql', { sql: query });
      if (error) {
        console.warn(`⚠️  Warning: ${error.message}`);
      } else {
        console.log('✅ Success');
      }
    }

    // Test connection
    console.log('🔍 Testing database connection...');
    const { data, error } = await supabase
      .from('warehouse_entries')
      .select('id')
      .limit(1);

    if (error) {
      console.error('❌ Database connection failed:', error);
    } else {
      console.log('✅ Database connection successful!');
    }

  } catch (error) {
    console.error('❌ Error removing permissions:', error);
  }
}

removePermissions();
