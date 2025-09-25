// Test script to verify disposal functions work
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://your-project.supabase.co'; // Replace with your actual URL
const supabaseKey = 'your-anon-key'; // Replace with your actual key

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDisposalFunctions() {
  console.log('Testing disposal functions...');
  
  try {
    // Test 1: Check if disposal_reasons table exists and has data
    console.log('\n1. Testing disposal_reasons table...');
    const { data: reasons, error: reasonsError } = await supabase
      .from('disposal_reasons')
      .select('*')
      .limit(5);
    
    if (reasonsError) {
      console.error('Error fetching disposal reasons:', reasonsError);
    } else {
      console.log('✅ Disposal reasons loaded:', reasons?.length || 0, 'records');
    }

    // Test 2: Test get_inventory_for_disposal function
    console.log('\n2. Testing get_inventory_for_disposal function...');
    const { data: inventory, error: inventoryError } = await supabase
      .rpc('get_inventory_for_disposal', {
        p_days_old: 30,
        p_include_storage_issues: true
      });
    
    if (inventoryError) {
      console.error('Error calling get_inventory_for_disposal:', inventoryError);
    } else {
      console.log('✅ Inventory for disposal loaded:', inventory?.length || 0, 'items');
      if (inventory && inventory.length > 0) {
        console.log('Sample item:', inventory[0]);
      }
    }

    // Test 3: Check existing disposal records
    console.log('\n3. Testing disposal_records table...');
    const { data: records, error: recordsError } = await supabase
      .from('disposal_records')
      .select('*')
      .limit(5);
    
    if (recordsError) {
      console.error('Error fetching disposal records:', recordsError);
    } else {
      console.log('✅ Disposal records loaded:', records?.length || 0, 'records');
    }

    console.log('\n✅ All disposal function tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDisposalFunctions();
