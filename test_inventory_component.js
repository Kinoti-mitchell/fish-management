// Simulate the inventory component data processing
const mockInventoryData = [
  {
    storage_location_id: '5cc7c667-8959-4dde-abe8-bd41d2b26d4e',
    storage_location_name: 'Cold Storage A',
    storage_location_type: 'cold_storage',
    storage_status: 'inactive',
    capacity_kg: 2000,
    current_usage_kg: 1083.75,
    available_capacity_kg: 916.25,
    utilization_percent: 54.19,
    size: 3,
    total_quantity: 1179,
    total_weight_kg: 412.65,
    batch_count: 1,
    contributing_batches: []
  },
  {
    storage_location_id: '5cc7c667-8959-4dde-abe8-bd41d2b26d4e',
    storage_location_name: 'Cold Storage A',
    storage_location_type: 'cold_storage',
    storage_status: 'inactive',
    capacity_kg: 2000,
    current_usage_kg: 1083.75,
    available_capacity_kg: 916.25,
    utilization_percent: 54.19,
    size: 5,
    total_quantity: 1179,
    total_weight_kg: 530.55,
    batch_count: 1,
    contributing_batches: []
  }
];

console.log('🧪 Testing inventory component data processing...');

// Simulate the storageUnits function
const units = {};

mockInventoryData.forEach((item) => {
  const key = item.storage_location_id || 'unknown';
  
  // Initialize storage unit if it doesn't exist
  if (!units[key]) {
    units[key] = {
      location: item.storage_location_name || 'Unknown Storage',
      location_id: item.storage_location_id || 'unknown',
      location_type: item.storage_location_type || 'unknown',
      status: item.storage_status || 'active', // This should preserve 'inactive'
      capacity_kg: item.capacity_kg || 0,
      current_usage_kg: item.current_usage_kg || 0,
      available_capacity_kg: item.available_capacity_kg || 0,
      utilization_percent: item.utilization_percent || 0,
      items: []
    };
  }

  // Add inventory item
  if (item.size !== null && item.size !== undefined && item.total_quantity > 0) {
    units[key].items.push({
      id: `${key}-${item.size}`,
      size: item.size,
      quantity: item.total_quantity,
      total_weight: item.total_weight_kg || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      batch_count: item.batch_count || 0,
      contributing_batches: item.contributing_batches || []
    });
  }
});

console.log('📊 Processed storage units:');
Object.values(units).forEach(unit => {
  console.log(`- ${unit.location}: status="${unit.status}", items: ${unit.items.length}`);
});

console.log('\n✅ Test completed. Status should be "inactive" for Cold Storage A.');
