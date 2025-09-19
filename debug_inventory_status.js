const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read the service role key
const serviceKey = fs.readFileSync('SUPABASE_SERVICE_ROLE_KEY', 'utf8').trim();
const supabaseUrl = 'https://pgpazwlejhysxabtkifz.supabase.co';

const supabase = createClient(supabaseUrl, serviceKey);

async function debugInventoryStatus() {
  try {
    console.log('🔍 Debugging inventory status processing...');
    
    // Step 1: Check raw storage locations data
    console.log('\n📊 Step 1: Raw storage locations from database');
    const { data: storageLocations, error: storageError } = await supabase
      .from('storage_locations')
      .select('id, name, location_type, capacity_kg, current_usage_kg, status')
      .order('name');
    
    if (storageError) {
      console.error('❌ Storage error:', storageError);
      return;
    }
    
    console.log('Raw storage locations:');
    storageLocations.forEach(loc => {
      console.log(`- ${loc.name}: status="${loc.status}" (type: ${typeof loc.status})`);
    });
    
    // Step 2: Simulate the inventory service processing
    console.log('\n🔄 Step 2: Simulating inventory service processing');
    const storageAggregation = {};
    
    storageLocations.forEach(location => {
      storageAggregation[location.id] = {
        storage_location_id: location.id,
        storage_location_name: location.name,
        storage_location_type: location.location_type,
        status: location.status || 'active', // This is the line that might be causing issues
        capacity_kg: location.capacity_kg || 0,
        current_usage_kg: 0,
        available_capacity_kg: location.capacity_kg || 0,
        utilization_percent: 0,
        sizes: {}
      };
    });
    
    console.log('Processed storage aggregation:');
    Object.values(storageAggregation).forEach(storage => {
      console.log(`- ${storage.storage_location_name}: status="${storage.status}"`);
    });
    
    // Step 3: Check if Cold Storage A has any inventory
    console.log('\n🧊 Step 3: Checking Cold Storage A inventory');
    const coldStorageA = storageLocations.find(s => s.name.toLowerCase().includes('cold storage a'));
    if (coldStorageA) {
      const { data: sortingResults, error: resultsError } = await supabase
        .from('sorting_results')
        .select('id, size_class, total_pieces, total_weight_grams, storage_location_id')
        .eq('storage_location_id', coldStorageA.id)
        .gt('total_weight_grams', 0);
      
      if (resultsError) {
        console.error('❌ Results error:', resultsError);
      } else {
        console.log(`Cold Storage A has ${sortingResults.length} inventory items`);
        if (sortingResults.length > 0) {
          console.log('Inventory items:', sortingResults);
        }
      }
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

debugInventoryStatus();
