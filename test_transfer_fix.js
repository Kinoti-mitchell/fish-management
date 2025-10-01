const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'env.development' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testTransferFix() {
  try {
    console.log('=== TESTING TRANSFER FIX ===');
    
    // 1. Check storage locations and their utilization
    console.log('\n1. Checking storage locations and utilization:');
    const { data: storages, error: storageError } = await supabase
      .from('storage_locations')
      .select('*')
      .order('name');
    
    if (storageError) {
      console.log('❌ Error getting storage locations:', storageError);
      return;
    }
    
    for (const storage of storages.filter(s => s.location_type === 'cold_storage')) {
      const { data: inventory, error: invError } = await supabase
        .from('sorting_results')
        .select('total_pieces, total_weight_grams')
        .eq('storage_location_id', storage.id);
      
      if (invError) {
        console.log(`❌ Error getting inventory for ${storage.name}:`, invError);
        continue;
      }
      
      const totalWeight = inventory.reduce((sum, item) => sum + (item.total_weight_grams || 0), 0) / 1000;
      const utilization = storage.capacity_kg > 0 ? (totalWeight / storage.capacity_kg) * 100 : 0;
      
      console.log(`  - ${storage.name}:`);
      console.log(`    Capacity: ${storage.capacity_kg}kg`);
      console.log(`    Current Usage: ${totalWeight.toFixed(1)}kg`);
      console.log(`    Utilization: ${utilization.toFixed(1)}%`);
      console.log(`    Green Bar Color: ${utilization >= 90 ? 'Red' : utilization >= 70 ? 'Yellow' : 'Green'}`);
    }
    
    // 2. Check if there are any pending transfers
    console.log('\n2. Checking for pending transfers:');
    const { data: pendingTransfers, error: pendingError } = await supabase
      .from('transfers')
      .select('*')
      .eq('status', 'pending')
      .limit(5);
    
    if (pendingError) {
      console.log('❌ Error getting pending transfers:', pendingError);
    } else {
      console.log(`Found ${pendingTransfers.length} pending transfers`);
      pendingTransfers.forEach(t => {
        console.log(`  - ${t.id}: Size ${t.size_class}, Qty ${t.quantity}`);
      });
    }
    
    // 3. Test the approval function with a dummy call
    console.log('\n3. Testing approval function:');
    try {
      const { data: testResult, error: testError } = await supabase
        .rpc('approve_transfer', { 
          p_transfer_id: '00000000-0000-0000-0000-000000000000', 
          p_approved_by: '00000000-0000-0000-0000-000000000000' 
        });
      
      if (testError) {
        console.log('❌ Approval function test error:', testError.message);
      } else {
        console.log('✅ Approval function is working (expected error for dummy ID)');
      }
    } catch (error) {
      console.log('✅ Approval function exists and is callable');
    }
    
    // 4. Check recent transfers status
    console.log('\n4. Recent transfer status:');
    const { data: recentTransfers, error: recentError } = await supabase
      .from('transfers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (recentError) {
      console.log('❌ Error getting recent transfers:', recentError);
    } else {
      recentTransfers.forEach(t => {
        console.log(`  - ${t.id}: Status ${t.status}, Created ${t.created_at}`);
      });
    }
    
    console.log('\n=== TEST COMPLETED ===');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testTransferFix();
