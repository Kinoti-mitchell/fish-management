const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read the service role key
const serviceKey = fs.readFileSync('SUPABASE_SERVICE_ROLE_KEY', 'utf8').trim();
const supabaseUrl = 'https://pgpazwlejhysxabtkifz.supabase.co';

const supabase = createClient(supabaseUrl, serviceKey);

async function traceInventoryData() {
  try {
    console.log('🔍 Tracing inventory data flow...');
    
    // Step 1: Get storage locations
    const { data: storageLocations, error: storageError } = await supabase
      .from('storage_locations')
      .select('id, name, location_type, capacity_kg, current_usage_kg, status')
      .order('name');
    
    if (storageError) throw storageError;
    
    // Step 2: Get sorting results
    const { data: sortingResults, error: resultsError } = await supabase
      .from('sorting_results')
      .select(`
        id,
        size_class,
        total_pieces,
        total_weight_grams,
        storage_location_id,
        sorting_batch:sorting_batches(
          id,
          batch_number,
          status,
          created_at
        )
      `)
      .eq('sorting_batch.status', 'completed')
      .not('storage_location_id', 'is', null)
      .gt('total_weight_grams', 0)
      .order('created_at', { ascending: false });
    
    if (resultsError) throw resultsError;
    
    // Step 3: Simulate the exact inventory service logic
    const storageMap = new Map();
    storageLocations.forEach(loc => {
      storageMap.set(loc.id, loc);
    });
    
    const storageAggregation = {};
    
    // Initialize all storage locations
    storageLocations.forEach(location => {
      storageAggregation[location.id] = {
        storage_location_id: location.id,
        storage_location_name: location.name,
        storage_location_type: location.location_type,
        status: location.status || 'active',
        capacity_kg: location.capacity_kg || 0,
        current_usage_kg: 0,
        available_capacity_kg: location.capacity_kg || 0,
        utilization_percent: 0,
        sizes: {}
      };
    });
    
    // Process sorting results
    sortingResults.forEach((result) => {
      const storageId = result.storage_location_id;
      const storage = storageMap.get(storageId);
      
      if (!storage || !storageAggregation[storageId]) return;
      
      const size = result.size_class;
      const qty = result.total_pieces || 0;
      const weightKg = (result.total_weight_grams || 0) / 1000;
      
      if (qty > 0) {
        if (!storageAggregation[storageId].sizes[size]) {
          storageAggregation[storageId].sizes[size] = {
            total_quantity: 0,
            total_weight_kg: 0,
            batch_count: 0,
            contributing_batches: []
          };
        }
        
        storageAggregation[storageId].sizes[size].total_quantity += qty;
        storageAggregation[storageId].sizes[size].total_weight_kg += weightKg;
        storageAggregation[storageId].sizes[size].batch_count += 1;
      }
    });
    
    // Calculate usage
    Object.values(storageAggregation).forEach(storage => {
      let totalWeight = 0;
      Object.values(storage.sizes).forEach(sizeData => {
        totalWeight += sizeData.total_weight_kg;
      });
      
      storage.current_usage_kg = totalWeight;
      storage.available_capacity_kg = Math.max(0, storage.capacity_kg - totalWeight);
      storage.utilization_percent = storage.capacity_kg > 0 ? 
        Math.round((totalWeight / storage.capacity_kg) * 100 * 100) / 100 : 0;
    });
    
    // Convert to result array
    const result = [];
    Object.values(storageAggregation).forEach(storage => {
      if (Object.keys(storage.sizes).length === 0) {
        // Empty storage location
        result.push({
          storage_location_id: storage.storage_location_id,
          storage_location_name: storage.storage_location_name,
          storage_location_type: storage.storage_location_type,
          storage_status: storage.status || 'active',
          capacity_kg: storage.capacity_kg,
          current_usage_kg: storage.current_usage_kg,
          available_capacity_kg: storage.available_capacity_kg,
          utilization_percent: storage.utilization_percent,
          size: null,
          total_quantity: 0,
          total_weight_kg: 0,
          batch_count: 0,
          contributing_batches: []
        });
      } else {
        // Storage with items
        Object.entries(storage.sizes).forEach(([sizeStr, sizeData]) => {
          result.push({
            storage_location_id: storage.storage_location_id,
            storage_location_name: storage.storage_location_name,
            storage_location_type: storage.storage_location_type,
            storage_status: storage.status || 'active',
            capacity_kg: storage.capacity_kg,
            current_usage_kg: storage.current_usage_kg,
            available_capacity_kg: storage.available_capacity_kg,
            utilization_percent: storage.utilization_percent,
            size: parseInt(sizeStr),
            total_quantity: sizeData.total_quantity,
            total_weight_kg: sizeData.total_weight_kg,
            batch_count: sizeData.batch_count,
            contributing_batches: sizeData.contributing_batches
          });
        });
      }
    });
    
    // Check Cold Storage A specifically
    console.log('\n🧊 Cold Storage A analysis:');
    const coldStorageAItems = result.filter(item => 
      item.storage_location_name.toLowerCase().includes('cold storage a')
    );
    
    if (coldStorageAItems.length > 0) {
      console.log(`Found ${coldStorageAItems.length} items for Cold Storage A:`);
      coldStorageAItems.forEach((item, index) => {
        console.log(`  ${index + 1}. Size: ${item.size}, Status: "${item.storage_status}", Qty: ${item.total_quantity}`);
      });
      
      // Check if all items have the same status
      const uniqueStatuses = [...new Set(coldStorageAItems.map(item => item.storage_status))];
      console.log(`Unique statuses: ${uniqueStatuses.join(', ')}`);
    } else {
      console.log('No items found for Cold Storage A');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

traceInventoryData();
