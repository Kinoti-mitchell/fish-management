#!/usr/bin/env node

/**
 * Check Size 3 Data - Simple approach to get Size 3 information
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/server.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🐟 Checking Size 3 Data...\n');
  
  try {
    // 1. Get Size 3 inventory data
    console.log('=== SIZE 3 INVENTORY DATA ===');
    const { data: inventory, error: inventoryError } = await supabase
      .from('sorting_results')
      .select('*')
      .eq('size_class', 3);

    if (inventoryError) {
      console.error('❌ Error fetching inventory:', inventoryError.message);
    } else if (inventory && inventory.length > 0) {
      console.log(`📊 Found ${inventory.length} Size 3 records:`);
      inventory.forEach((item, index) => {
        console.log(`\n${index + 1}. Record ID: ${item.id}`);
        console.log(`   - Quantity: ${item.total_pieces} pieces`);
        console.log(`   - Weight: ${(item.total_weight_grams / 1000).toFixed(1)}kg`);
        console.log(`   - Avg Weight/Fish: ${((item.total_weight_grams / 1000) / item.total_pieces).toFixed(2)}kg`);
        console.log(`   - Storage Location ID: ${item.storage_location_id}`);
        console.log(`   - Sorting Batch ID: ${item.sorting_batch_id}`);
        console.log(`   - Transfer Source Storage ID: ${item.transfer_source_storage_id || 'None'}`);
        console.log(`   - Transfer Source Storage Name: ${item.transfer_source_storage_name || 'None'}`);
        console.log(`   - Transfer ID: ${item.transfer_id || 'None'}`);
        console.log(`   - Created: ${new Date(item.created_at).toLocaleDateString()}`);
        console.log(`   - Updated: ${new Date(item.updated_at).toLocaleDateString()}`);
      });
    } else {
      console.log('No Size 3 inventory found');
    }

    // 2. Get storage locations
    console.log('\n=== STORAGE LOCATIONS ===');
    const { data: storage, error: storageError } = await supabase
      .from('storage_locations')
      .select('*');

    if (storageError) {
      console.error('❌ Error fetching storage locations:', storageError.message);
    } else if (storage && storage.length > 0) {
      console.log('🏪 Storage Locations:');
      storage.forEach(location => {
        console.log(`  - ID: ${location.id} | Name: ${location.name}`);
      });
    }

    // 3. Try to get sorting batches
    console.log('\n=== SORTING BATCHES ===');
    const { data: batches, error: batchError } = await supabase
      .from('sorting_batches')
      .select('*')
      .limit(5);

    if (batchError) {
      console.error('❌ Error fetching sorting batches:', batchError.message);
    } else if (batches && batches.length > 0) {
      console.log('📦 Sample Sorting Batches:');
      batches.forEach(batch => {
        console.log(`  - ID: ${batch.id} | Batch Number: ${batch.batch_number} | Status: ${batch.status}`);
      });
    }

    // 4. Try to get farmers
    console.log('\n=== FARMERS ===');
    const { data: farmers, error: farmerError } = await supabase
      .from('farmers')
      .select('*')
      .limit(5);

    if (farmerError) {
      console.error('❌ Error fetching farmers:', farmerError.message);
    } else if (farmers && farmers.length > 0) {
      console.log('👨‍🌾 Sample Farmers:');
      farmers.forEach(farmer => {
        console.log(`  - ID: ${farmer.id} | Name: ${farmer.name}`);
      });
    }

    // 5. Check if transfers table exists and is accessible
    console.log('\n=== TRANSFERS TABLE CHECK ===');
    const { data: transfers, error: transferError } = await supabase
      .from('transfers')
      .select('*')
      .limit(1);

    if (transferError) {
      console.error('❌ Error accessing transfers table:', transferError.message);
      console.log('   This might be a permissions issue or the table might not exist.');
    } else {
      console.log('✅ Transfers table is accessible');
      if (transfers && transfers.length > 0) {
        console.log('📋 Sample transfer record:');
        console.log(JSON.stringify(transfers[0], null, 2));
      }
    }

    console.log('\n🎉 Data Check Complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().catch(console.error);
