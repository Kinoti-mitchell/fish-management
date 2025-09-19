const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSortingService() {
  try {
    console.log('🔍 Testing sorting service...\n');
    
    // Test the same query as the sorting service
    const { data, error } = await supabase
      .from('processing_records')
      .select(`
        *,
        warehouse_entry:warehouse_entries(
          id,
          entry_date,
          total_weight,
          farmer_id,
          entry_code
        ),
        sorting_batches!left(
          id,
          status
        )
      `)
      .gt('post_processing_weight', 0)
      .gt('ready_for_dispatch_count', 0)
      .order('processing_date', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching processing records:', error);
      return;
    }
    
    console.log(`📊 Total processing records with weight > 0: ${data?.length || 0}\n`);
    
    // Filter out records that are already sorted
    const records = data || [];
    const unsortedRecords = records.filter(record => {
      const hasCompletedBatch = record.sorting_batches?.some((batch) => batch.status === 'completed');
      return !hasCompletedBatch;
    });
    
    console.log(`🎯 Unsorted records (ready for sorting): ${unsortedRecords.length}\n`);
    
    if (unsortedRecords.length > 0) {
      console.log('📋 Unsorted Processing Records:');
      unsortedRecords.forEach((record, index) => {
        console.log(`${index + 1}. Processing Code: ${record.processing_code || 'N/A'}`);
        console.log(`   Weight: ${record.post_processing_weight}kg`);
        console.log(`   Pieces: ${record.ready_for_dispatch_count}`);
        console.log(`   Processing Date: ${record.processing_date}`);
        console.log(`   Sorting Batches: ${record.sorting_batches?.length || 0}`);
        console.log('');
      });
    } else {
      console.log('✅ No unsorted processing records found - all records have been sorted!');
    }
    
    // Show sorted records for comparison
    const sortedRecords = records.filter(record => {
      const hasCompletedBatch = record.sorting_batches?.some((batch) => batch.status === 'completed');
      return hasCompletedBatch;
    });
    
    if (sortedRecords.length > 0) {
      console.log(`\n✅ Already sorted records: ${sortedRecords.length}`);
      sortedRecords.forEach((record, index) => {
        console.log(`${index + 1}. Processing Code: ${record.processing_code || 'N/A'} (SORTED)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSortingService();
