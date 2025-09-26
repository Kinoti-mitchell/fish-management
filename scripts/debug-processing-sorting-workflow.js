// Debug the processing and sorting workflow to identify issues
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './env.development' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function debugProcessingSortingWorkflow() {
  console.log('🔍 Debugging processing and sorting workflow...\n');
  
  try {
    // 1. Check warehouse entries
    console.log('1️⃣ Checking warehouse entries...');
    const { data: warehouseEntries, error: warehouseError } = await supabase
      .from('warehouse_entries')
      .select('id, entry_date, total_weight, total_pieces, condition, farmer_id, farmers(name)')
      .order('entry_date', { ascending: false })
      .limit(10);
    
    if (warehouseError) {
      console.log('❌ Error fetching warehouse entries:', warehouseError);
    } else {
      console.log('✅ Warehouse entries found:', warehouseEntries?.length || 0);
      warehouseEntries?.forEach(entry => {
        console.log(`  - ${entry.entry_date}: ${entry.total_weight}kg, ${entry.total_pieces} pieces - Farmer: ${entry.farmers?.name || 'Unknown'}`);
      });
    }
    
    // 2. Check processing records
    console.log('\n2️⃣ Checking processing records...');
    const { data: processingRecords, error: processingError } = await supabase
      .from('processing_records')
      .select(`
        id,
        processing_date,
        pre_processing_weight,
        post_processing_weight,
        ready_for_dispatch_count,
        warehouse_entry_id,
        warehouse_entry:warehouse_entries(
          id,
          entry_date,
          total_weight,
          farmers(name)
        )
      `)
      .order('processing_date', { ascending: false })
      .limit(10);
    
    if (processingError) {
      console.log('❌ Error fetching processing records:', processingError);
    } else {
      console.log('✅ Processing records found:', processingRecords?.length || 0);
      processingRecords?.forEach(record => {
        console.log(`  - ${record.processing_date}: ${record.pre_processing_weight}kg → ${record.post_processing_weight}kg - Ready: ${record.ready_for_dispatch_count} - Farmer: ${record.warehouse_entry?.farmers?.name || 'Unknown'}`);
      });
    }
    
    // 3. Check sorting batches
    console.log('\n3️⃣ Checking sorting batches...');
    const { data: sortingBatches, error: batchError } = await supabase
      .from('sorting_batches')
      .select(`
        id,
        batch_number,
        processing_record_id,
        total_weight_grams,
        total_pieces,
        status,
        created_at,
        processing_record:processing_records(
          id,
          processing_date,
          warehouse_entry:warehouse_entries(
            id,
            farmers(name)
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (batchError) {
      console.log('❌ Error fetching sorting batches:', batchError);
    } else {
      console.log('✅ Sorting batches found:', sortingBatches?.length || 0);
      sortingBatches?.forEach(batch => {
        console.log(`  - ${batch.batch_number}: ${batch.total_weight_grams}g, ${batch.total_pieces} pieces - Status: ${batch.status} - Farmer: ${batch.processing_record?.warehouse_entry?.farmers?.name || 'Unknown'}`);
      });
    }
    
    // 4. Check sorting results
    console.log('\n4️⃣ Checking sorting results...');
    const { data: sortingResults, error: resultsError } = await supabase
      .from('sorting_results')
      .select(`
        id,
        size_class,
        total_pieces,
        total_weight_grams,
        storage_location_id,
        sorting_batch_id,
        sorting_batch:sorting_batches(
          id,
          batch_number,
          status
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (resultsError) {
      console.log('❌ Error fetching sorting results:', resultsError);
    } else {
      console.log('✅ Sorting results found:', sortingResults?.length || 0);
      sortingResults?.forEach(result => {
        console.log(`  - Size ${result.size_class}: ${result.total_pieces} pieces (${result.total_weight_grams}g) - Batch: ${result.sorting_batch?.batch_number} (${result.sorting_batch?.status})`);
      });
    }
    
    // 5. Check the workflow chain
    console.log('\n5️⃣ Checking workflow chain...');
    
    // Find warehouse entries without processing records
    const { data: unprocessedEntries, error: unprocessedError } = await supabase
      .from('warehouse_entries')
      .select('id, entry_date, total_weight, farmers(name)')
      .not('id', 'in', `(SELECT warehouse_entry_id FROM processing_records WHERE warehouse_entry_id IS NOT NULL)`)
      .order('entry_date', { ascending: false })
      .limit(5);
    
    if (unprocessedError) {
      console.log('❌ Error checking unprocessed entries:', unprocessedError);
    } else {
      console.log('📋 Warehouse entries without processing records:', unprocessedEntries?.length || 0);
      unprocessedEntries?.forEach(entry => {
        console.log(`  - ${entry.entry_date}: ${entry.total_weight}kg - Farmer: ${entry.farmers?.name || 'Unknown'}`);
      });
    }
    
    // Find processing records without sorting batches
    const { data: unprocessedRecords, error: unprocessedRecordsError } = await supabase
      .from('processing_records')
      .select('id, processing_date, post_processing_weight, warehouse_entry:warehouse_entries(farmers(name))')
      .not('id', 'in', `(SELECT processing_record_id FROM sorting_batches WHERE processing_record_id IS NOT NULL)`)
      .order('processing_date', { ascending: false })
      .limit(5);
    
    if (unprocessedRecordsError) {
      console.log('❌ Error checking unprocessed records:', unprocessedRecordsError);
    } else {
      console.log('📋 Processing records without sorting batches:', unprocessedRecords?.length || 0);
      unprocessedRecords?.forEach(record => {
        console.log(`  - ${record.processing_date}: ${record.post_processing_weight}kg - Farmer: ${record.warehouse_entry?.farmers?.name || 'Unknown'}`);
      });
    }
    
    // 6. Summary and recommendations
    console.log('\n📋 WORKFLOW ANALYSIS:');
    console.log('='.repeat(50));
    
    const warehouseCount = warehouseEntries?.length || 0;
    const processingCount = processingRecords?.length || 0;
    const sortingBatchCount = sortingBatches?.length || 0;
    const sortingResultCount = sortingResults?.length || 0;
    const unprocessedEntriesCount = unprocessedEntries?.length || 0;
    const unprocessedRecordsCount = unprocessedRecords?.length || 0;
    
    console.log(`📊 Data Flow Summary:`);
    console.log(`  - Warehouse entries: ${warehouseCount}`);
    console.log(`  - Processing records: ${processingCount}`);
    console.log(`  - Sorting batches: ${sortingBatchCount}`);
    console.log(`  - Sorting results: ${sortingResultCount}`);
    console.log(`  - Unprocessed entries: ${unprocessedEntriesCount}`);
    console.log(`  - Unprocessed records: ${unprocessedRecordsCount}`);
    
    console.log(`\n🔧 Issues Found:`);
    
    if (warehouseCount === 0) {
      console.log('❌ No warehouse entries - start by creating warehouse entries');
    }
    
    if (unprocessedEntriesCount > 0) {
      console.log(`❌ ${unprocessedEntriesCount} warehouse entries need processing`);
    }
    
    if (unprocessedRecordsCount > 0) {
      console.log(`❌ ${unprocessedRecordsCount} processing records need sorting`);
    }
    
    if (sortingBatchCount === 0) {
      console.log('❌ No sorting batches - create sorting batches from processing records');
    }
    
    if (sortingResultCount === 0) {
      console.log('❌ No sorting results - complete sorting operations');
    }
    
    if (warehouseCount > 0 && processingCount > 0 && sortingBatchCount > 0 && sortingResultCount > 0) {
      console.log('✅ Workflow appears to be working correctly');
    }
    
    console.log(`\n🎯 Recommendations:`);
    if (unprocessedEntriesCount > 0) {
      console.log('1. Process warehouse entries to create processing records');
    }
    if (unprocessedRecordsCount > 0) {
      console.log('2. Create sorting batches from processing records');
    }
    if (sortingBatchCount > 0 && sortingResultCount === 0) {
      console.log('3. Complete sorting operations to create sorting results');
    }
    
  } catch (error) {
    console.log('❌ Exception during debugging:', error);
  }
}

async function runDebug() {
  console.log('🚀 Starting processing and sorting workflow debugging...\n');
  await debugProcessingSortingWorkflow();
  console.log('\n🏁 Debugging complete!');
}

runDebug().catch(console.error);
