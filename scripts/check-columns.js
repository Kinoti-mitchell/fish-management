const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/server.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkColumns() {
  console.log('🔍 Checking database columns...\n');

  // Check processing_records columns
  try {
    console.log('📋 Checking processing_records table...');
    const { data: prData, error: prError } = await supabase
      .from('processing_records')
      .select('id, processing_code, total_pieces')
      .limit(1);

    if (prError) {
      console.error(`❌ processing_records error: ${prError.message}`);
    } else {
      console.log('✅ processing_records columns exist');
      console.log('   - processing_code: ✅');
      console.log('   - total_pieces: ✅');
    }
  } catch (err) {
    console.error(`❌ processing_records test failed: ${err.message}`);
  }

  // Check warehouse_entries columns
  try {
    console.log('\n📦 Checking warehouse_entries table...');
    const { data: weData, error: weError } = await supabase
      .from('warehouse_entries')
      .select('id, entry_code')
      .limit(1);

    if (weError) {
      console.error(`❌ warehouse_entries error: ${weError.message}`);
    } else {
      console.log('✅ warehouse_entries columns exist');
      console.log('   - entry_code: ✅');
    }
  } catch (err) {
    console.error(`❌ warehouse_entries test failed: ${err.message}`);
  }

  console.log('\n🎉 Column check completed!');
}

checkColumns();
