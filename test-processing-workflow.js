const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './env.development' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testProcessingWorkflow() {
  console.log('🧪 Testing Processing Workflow...\n');
  
  try {
    // Step 1: Check warehouse entries available for processing
    console.log('📦 Step 1: Checking warehouse entries...');
    const { data: warehouseEntries, error: warehouseError } = await supabase
      .from('warehouse_entries')
      .select(`
        id,
        entry_date,
        total_weight,
        total_pieces,
        condition,
        fish_type,
        farmer_id,
        entry_code,
        farmers!inner(name)
      `)
      .order('entry_date', { ascending: false })
      .limit(5);
    
    if (warehouseError) {
      console.log(`❌ Error fetching warehouse entries: ${warehouseError.message}`);
      return;
    }
    
    console.log(`✅ Found ${warehouseEntries?.length || 0} warehouse entries`);
    if (warehouseEntries && warehouseEntries.length > 0) {
      console.log('📝 Sample warehouse entries:');
      warehouseEntries.slice(0, 3).forEach((entry, i) => {
        console.log(`  ${i+1}. ${entry.entry_code} | ${entry.total_weight}kg | ${entry.fish_type} | Farmer: ${entry.farmers?.name}`);
      });
    }
    
    // Step 2: Check which entries are already processed
    console.log('\n🔄 Step 2: Checking processing records...');
    const { data: processingRecords, error: processingError } = await supabase
      .from('processing_records')
      .select('warehouse_entry_id, processing_code, post_processing_weight, created_at')
      .order('created_at', { ascending: false });
    
    if (processingError) {
      console.log(`❌ Error fetching processing records: ${processingError.message}`);
    } else {
      console.log(`✅ Found ${processingRecords?.length || 0} processing records`);
      
      if (processingRecords && processingRecords.length > 0) {
        console.log('📝 Sample processing records:');
        processingRecords.slice(0, 3).forEach((record, i) => {
          console.log(`  ${i+1}. ${record.processing_code} | ${record.post_processing_weight}kg | Entry ID: ${record.warehouse_entry_id?.slice(-8)}`);
        });
      }
    }
    
    // Step 3: Find unprocessed warehouse entries
    console.log('\n🎯 Step 3: Finding unprocessed warehouse entries...');
    const processedEntryIds = new Set(
      processingRecords?.map(record => record.warehouse_entry_id) || []
    );
    
    const unprocessedEntries = warehouseEntries?.filter(entry => 
      !processedEntryIds.has(entry.id)
    ) || [];
    
    console.log(`✅ Found ${unprocessedEntries.length} unprocessed warehouse entries`);
    
    if (unprocessedEntries.length > 0) {
      console.log('📝 Unprocessed entries ready for processing:');
      unprocessedEntries.slice(0, 3).forEach((entry, i) => {
        console.log(`  ${i+1}. ${entry.entry_code} | ${entry.total_weight}kg | ${entry.fish_type} | Farmer: ${entry.farmers?.name}`);
      });
      
      console.log('\n💡 Next Steps:');
      console.log('  1. Go to Processing Management in your app');
      console.log('  2. Select one of the unprocessed warehouse entries');
      console.log('  3. Fill in the processing form with:');
      console.log('     - Pre-processing weight (same as warehouse entry weight)');
      console.log('     - Post-processing weight (after cleaning/processing)');
      console.log('     - Processing waste (difference between pre and post)');
      console.log('     - Final grade (A, B, or C)');
      console.log('     - Fish type');
      console.log('  4. Submit to create a processing record');
      console.log('  5. Then go to Sorting Management to sort the processed fish');
    } else {
      console.log('✅ All warehouse entries have been processed!');
      console.log('💡 You can now go to Sorting Management to sort the processed fish.');
    }
    
    // Step 4: Check sorting batches
    console.log('\n🔍 Step 4: Checking sorting batches...');
    const { data: sortingBatches, error: sortingError } = await supabase
      .from('sorting_batches')
      .select('id, batch_number, status, total_weight_grams, created_at')
      .order('created_at', { ascending: false });
    
    if (sortingError) {
      console.log(`❌ Error fetching sorting batches: ${sortingError.message}`);
    } else {
      console.log(`✅ Found ${sortingBatches?.length || 0} sorting batches`);
      
      if (sortingBatches && sortingBatches.length > 0) {
        console.log('📝 Sample sorting batches:');
        sortingBatches.slice(0, 3).forEach((batch, i) => {
          console.log(`  ${i+1}. ${batch.batch_number} | ${batch.status} | ${batch.total_weight_grams ? (batch.total_weight_grams / 1000).toFixed(1) : 0}kg`);
        });
      }
    }
    
    console.log('\n📊 Workflow Status Summary:');
    console.log(`  • Warehouse Entries: ${warehouseEntries?.length || 0}`);
    console.log(`  • Processing Records: ${processingRecords?.length || 0}`);
    console.log(`  • Sorting Batches: ${sortingBatches?.length || 0}`);
    console.log(`  • Unprocessed Entries: ${unprocessedEntries.length}`);
    
    if (unprocessedEntries.length > 0) {
      console.log('\n🚀 Ready to Process!');
      console.log('   Your app is ready to process fish from warehouse entries.');
    } else if (processingRecords?.length > 0 && sortingBatches?.length === 0) {
      console.log('\n🔀 Ready to Sort!');
      console.log('   Your app is ready to sort the processed fish.');
    } else if (sortingBatches?.length > 0) {
      console.log('\n✅ Workflow Complete!');
      console.log('   Fish have been processed and sorted successfully.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testProcessingWorkflow();
