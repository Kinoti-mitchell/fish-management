// Debug Size 9 in inventory data
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://your-project.supabase.co'; // Replace with your actual URL
const supabaseKey = 'your-anon-key'; // Replace with your actual key

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSize9Inventory() {
  console.log('🔍 Debugging Size 9 in inventory data...');
  
  try {
    // Get the same data that the inventory service uses
    const { data: sortingResults, error } = await supabase
      .from('sorting_results')
      .select(`
        id,
        size_class,
        total_pieces,
        total_weight_grams,
        storage_location_id,
        sorting_batch_id,
        transfer_source_storage_id,
        transfer_source_storage_name,
        transfer_id,
        sorting_batch:sorting_batches(
          id,
          batch_number,
          status,
          created_at,
          processing_record:processing_records(
            id,
            processing_date,
            warehouse_entry:warehouse_entries(
              id,
              entry_date,
              farmer_id,
              farmers(name, phone, location)
            )
          )
        )
      `)
      .not('storage_location_id', 'is', null)
      .gt('total_weight_grams', 0)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching sorting results:', error);
      return;
    }

    console.log('📦 Total sorting results:', sortingResults?.length || 0);
    
    // Filter for Size 9
    const size9Results = sortingResults?.filter(result => result.size_class === 9) || [];
    console.log('🔍 Size 9 sorting results:', size9Results);
    
    if (size9Results.length > 0) {
      console.log('📊 Size 9 summary:');
      console.log('- Total records:', size9Results.length);
      console.log('- Total pieces:', size9Results.reduce((sum, r) => sum + (r.total_pieces || 0), 0));
      console.log('- Total weight (grams):', size9Results.reduce((sum, r) => sum + (r.total_weight_grams || 0), 0));
      console.log('- Total weight (kg):', size9Results.reduce((sum, r) => sum + (r.total_weight_grams || 0), 0) / 1000);
      
      // Check storage locations
      const storageIds = [...new Set(size9Results.map(r => r.storage_location_id))];
      console.log('- Storage locations:', storageIds);
      
      // Check batch status
      const batchStatuses = size9Results.map(r => r.sorting_batch?.status).filter(Boolean);
      console.log('- Batch statuses:', [...new Set(batchStatuses)]);
    } else {
      console.log('❌ No Size 9 results found!');
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugSize9Inventory();
