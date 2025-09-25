const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/server.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testEntryCodes() {
  console.log('🔍 Testing Entry Code System...\n');

  // Test 1: Check warehouse entries
  try {
    console.log('📦 Testing Warehouse Entries...');
    const { data: warehouseEntries, error: weError } = await supabase
      .from('warehouse_entries')
      .select('id, entry_code, created_at')
      .order('created_at')
      .limit(10);

    if (weError) {
      console.error(`❌ Warehouse entries error: ${weError.message}`);
    } else {
      console.log(`✅ Found ${warehouseEntries?.length || 0} warehouse entries`);
      if (warehouseEntries && warehouseEntries.length > 0) {
        console.log('Entry codes:');
        warehouseEntries.forEach(entry => {
          console.log(`  - ${entry.entry_code || 'NO CODE'} (${entry.id})`);
        });
      }
    }
  } catch (err) {
    console.error(`❌ Warehouse entries test failed: ${err.message}`);
  }

  console.log('');

  // Test 2: Check processing records
  try {
    console.log('⚙️  Testing Processing Records...');
    const { data: processingRecords, error: prError } = await supabase
      .from('processing_records')
      .select('id, processing_code, processing_date')
      .order('processing_date')
      .limit(10);

    if (prError) {
      console.error(`❌ Processing records error: ${prError.message}`);
    } else {
      console.log(`✅ Found ${processingRecords?.length || 0} processing records`);
      if (processingRecords && processingRecords.length > 0) {
        console.log('Processing codes:');
        processingRecords.forEach(record => {
          console.log(`  - ${record.processing_code || 'NO CODE'} (${record.id})`);
        });
      }
    }
  } catch (err) {
    console.error(`❌ Processing records test failed: ${err.message}`);
  }

  console.log('');

  // Test 3: Check for duplicates
  try {
    console.log('🔍 Checking for duplicate codes...');
    
    // Check warehouse entry codes
    const { data: weCodes, error: weCodesError } = await supabase
      .from('warehouse_entries')
      .select('entry_code')
      .not('entry_code', 'is', null);

    if (!weCodesError && weCodes) {
      const weCodeCounts = {};
      weCodes.forEach(entry => {
        weCodeCounts[entry.entry_code] = (weCodeCounts[entry.entry_code] || 0) + 1;
      });
      
      const weDuplicates = Object.entries(weCodeCounts).filter(([code, count]) => count > 1);
      if (weDuplicates.length > 0) {
        console.log(`❌ Found duplicate warehouse entry codes: ${weDuplicates.map(([code]) => code).join(', ')}`);
      } else {
        console.log('✅ No duplicate warehouse entry codes found');
      }
    }

    // Check processing codes
    const { data: prCodes, error: prCodesError } = await supabase
      .from('processing_records')
      .select('processing_code')
      .not('processing_code', 'is', null);

    if (!prCodesError && prCodes) {
      const prCodeCounts = {};
      prCodes.forEach(record => {
        prCodeCounts[record.processing_code] = (prCodeCounts[record.processing_code] || 0) + 1;
      });
      
      const prDuplicates = Object.entries(prCodeCounts).filter(([code, count]) => count > 1);
      if (prDuplicates.length > 0) {
        console.log(`❌ Found duplicate processing codes: ${prDuplicates.map(([code]) => code).join(', ')}`);
      } else {
        console.log('✅ No duplicate processing codes found');
      }
    }
  } catch (err) {
    console.error(`❌ Duplicate check failed: ${err.message}`);
  }

  console.log('');

  // Test 4: Check database functions
  try {
    console.log('🔧 Testing database functions...');
    
    // Test warehouse entry code generation
    const { data: weCode, error: weCodeError } = await supabase
      .rpc('generate_warehouse_entry_code');

    if (weCodeError) {
      console.log(`⚠️  Warehouse entry code function: ${weCodeError.message}`);
    } else {
      console.log(`✅ Warehouse entry code function works: ${weCode}`);
    }

    // Test processing code generation
    const { data: prCode, error: prCodeError } = await supabase
      .rpc('generate_processing_code');

    if (prCodeError) {
      console.log(`⚠️  Processing code function: ${prCodeError.message}`);
    } else {
      console.log(`✅ Processing code function works: ${prCode}`);
    }
  } catch (err) {
    console.error(`❌ Function test failed: ${err.message}`);
  }

  console.log('\n🎉 Entry code system test completed!');
}

testEntryCodes();
