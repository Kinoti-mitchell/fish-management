#!/usr/bin/env node

/**
 * Pull Size 3 Transfer Details - Simple approach using Supabase client
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
  console.log('🐟 Pulling Size 3 Transfer Details...\n');
  
  try {
    // 1. Get current Size 3 inventory in storage 1
    console.log('=== CURRENT SIZE 3 INVENTORY ===');
    const { data: inventory, error: inventoryError } = await supabase
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
        created_at,
        updated_at,
        storage_locations!inner(name)
      `)
      .eq('storage_locations.name', 'storage 1')
      .eq('size_class', 3);

    if (inventoryError) {
      console.error('❌ Error fetching inventory:', inventoryError.message);
    } else if (inventory && inventory.length > 0) {
      console.log('📊 Current Size 3 Inventory in Storage 1:');
      inventory.forEach(item => {
        console.log(`  - ID: ${item.id}`);
        console.log(`  - Quantity: ${item.total_pieces} pieces`);
        console.log(`  - Weight: ${(item.total_weight_grams / 1000).toFixed(1)}kg`);
        console.log(`  - Avg Weight/Fish: ${((item.total_weight_grams / 1000) / item.total_pieces).toFixed(2)}kg`);
        console.log(`  - Transfer Source: ${item.transfer_source_storage_name || 'Direct from processing'}`);
        console.log(`  - Transfer ID: ${item.transfer_id || 'N/A'}`);
        console.log(`  - Added Date: ${new Date(item.created_at).toLocaleDateString()}`);
        console.log('  ---');
      });
    } else {
      console.log('No Size 3 inventory found in storage 1');
    }

    // 2. Get batch information
    console.log('\n=== SIZE 3 BATCH INFORMATION ===');
    const { data: batchInfo, error: batchError } = await supabase
      .from('sorting_results')
      .select(`
        sorting_batch_id,
        sorting_batches!inner(
          id,
          batch_number,
          created_at,
          status,
          processing_records!inner(
            processing_date,
            warehouse_entries!inner(
              farmer_id,
              farmers!inner(name)
            )
          )
        )
      `)
      .eq('size_class', 3)
      .eq('storage_locations.name', 'storage 1');

    if (batchError) {
      console.error('❌ Error fetching batch info:', batchError.message);
    } else if (batchInfo && batchInfo.length > 0) {
      console.log('📋 Batch Information:');
      batchInfo.forEach(item => {
        const batch = item.sorting_batches;
        if (batch) {
          console.log(`  - Batch Number: ${batch.batch_number}`);
          console.log(`  - Processing Date: ${batch.processing_records?.processing_date || 'N/A'}`);
          console.log(`  - Farmer: ${batch.processing_records?.warehouse_entries?.farmers?.name || 'N/A'}`);
          console.log(`  - Batch Status: ${batch.status}`);
          console.log(`  - Created: ${new Date(batch.created_at).toLocaleDateString()}`);
          console.log('  ---');
        }
      });
    }

    // 3. Get transfer history for Size 3
    console.log('\n=== SIZE 3 TRANSFER HISTORY ===');
    const { data: transfers, error: transferError } = await supabase
      .from('transfers')
      .select('*')
      .eq('size_class', 3)
      .or('from_storage_name.eq.storage 1,to_storage_name.eq.storage 1')
      .order('created_at', { ascending: false });

    if (transferError) {
      console.error('❌ Error fetching transfers:', transferError.message);
    } else if (transfers && transfers.length > 0) {
      console.log('🔄 Transfer History:');
      transfers.forEach(transfer => {
        console.log(`  - Transfer ID: ${transfer.id}`);
        console.log(`  - From: ${transfer.from_storage_name} → To: ${transfer.to_storage_name}`);
        console.log(`  - Quantity: ${transfer.quantity} pieces`);
        console.log(`  - Weight: ${transfer.weight_kg}kg`);
        console.log(`  - Status: ${transfer.status}`);
        console.log(`  - Direction: ${transfer.to_storage_name === 'storage 1' ? 'INCOMING to storage 1' : 'OUTGOING from storage 1'}`);
        console.log(`  - Created: ${new Date(transfer.created_at).toLocaleDateString()}`);
        if (transfer.completed_at) {
          console.log(`  - Completed: ${new Date(transfer.completed_at).toLocaleDateString()}`);
        }
        console.log(`  - Notes: ${transfer.notes || 'No notes'}`);
        console.log('  ---');
      });
    } else {
      console.log('No transfer history found for Size 3');
    }

    // 4. Get completed transfers to storage 1
    console.log('\n=== COMPLETED TRANSFERS TO STORAGE 1 ===');
    const { data: completedTransfers, error: completedError } = await supabase
      .from('transfers')
      .select('*')
      .eq('size_class', 3)
      .eq('to_storage_name', 'storage 1')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    if (completedError) {
      console.error('❌ Error fetching completed transfers:', completedError.message);
    } else if (completedTransfers && completedTransfers.length > 0) {
      console.log('✅ Completed Transfers to Storage 1:');
      completedTransfers.forEach(transfer => {
        const daysSince = Math.floor((new Date() - new Date(transfer.completed_at)) / (1000 * 60 * 60 * 24));
        console.log(`  - Transfer ID: ${transfer.id}`);
        console.log(`  - Source: ${transfer.from_storage_name}`);
        console.log(`  - Quantity: ${transfer.quantity} pieces`);
        console.log(`  - Weight: ${transfer.weight_kg}kg`);
        console.log(`  - Completed: ${new Date(transfer.completed_at).toLocaleDateString()} (${daysSince} days ago)`);
        console.log('  ---');
      });
    } else {
      console.log('No completed transfers found for Size 3 to storage 1');
    }

    // 5. Get pending transfers
    console.log('\n=== PENDING TRANSFERS ===');
    const { data: pendingTransfers, error: pendingError } = await supabase
      .from('transfers')
      .select('*')
      .eq('size_class', 3)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (pendingError) {
      console.error('❌ Error fetching pending transfers:', pendingError.message);
    } else if (pendingTransfers && pendingTransfers.length > 0) {
      console.log('⏳ Pending Transfers:');
      pendingTransfers.forEach(transfer => {
        const daysPending = Math.floor((new Date() - new Date(transfer.created_at)) / (1000 * 60 * 60 * 24));
        console.log(`  - Transfer ID: ${transfer.id}`);
        console.log(`  - From: ${transfer.from_storage_name} → To: ${transfer.to_storage_name}`);
        console.log(`  - Quantity: ${transfer.quantity} pieces`);
        console.log(`  - Weight: ${transfer.weight_kg}kg`);
        console.log(`  - Requested: ${new Date(transfer.created_at).toLocaleDateString()} (${daysPending} days ago)`);
        console.log('  ---');
      });
    } else {
      console.log('No pending transfers found for Size 3');
    }

    // 6. Summary
    console.log('\n=== TRANSFER SUMMARY ===');
    const { data: allTransfers, error: summaryError } = await supabase
      .from('transfers')
      .select('*')
      .eq('size_class', 3)
      .or('from_storage_name.eq.storage 1,to_storage_name.eq.storage 1');

    if (summaryError) {
      console.error('❌ Error fetching summary:', summaryError.message);
    } else if (allTransfers && allTransfers.length > 0) {
      const totalTransfers = allTransfers.length;
      const completedToStorage1 = allTransfers.filter(t => t.to_storage_name === 'storage 1' && t.status === 'completed').length;
      const pending = allTransfers.filter(t => t.status === 'pending').length;
      const totalWeight = allTransfers.reduce((sum, t) => sum + (t.weight_kg || 0), 0);
      const totalQuantity = allTransfers.reduce((sum, t) => sum + (t.quantity || 0), 0);

      console.log('📊 Summary Statistics:');
      console.log(`  - Total Transfers: ${totalTransfers}`);
      console.log(`  - Completed to Storage 1: ${completedToStorage1}`);
      console.log(`  - Pending: ${pending}`);
      console.log(`  - Total Weight Transferred: ${totalWeight.toFixed(1)}kg`);
      console.log(`  - Total Quantity Transferred: ${totalQuantity} pieces`);
    }

    console.log('\n🎉 Size 3 Transfer Analysis Complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().catch(console.error);
