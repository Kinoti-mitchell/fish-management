const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', 'server', 'server.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function findDeniedTransfers() {
  try {
    console.log('🔍 Finding denied transfers for User f5946671...');
    
    const { data, error } = await supabase
      .from('transfers')
      .select(`
        id,
        from_storage_location_id,
        to_storage_location_id,
        size_class,
        quantity_kg,
        quantity_pieces,
        status,
        notes,
        created_at,
        approved_by,
        approved_at,
        storage_locations!transfers_from_storage_location_id_fkey(name),
        storage_locations!transfers_to_storage_location_id_fkey(name)
      `)
      .like('notes', '%Transfer from Cold Storage B - Sizes: 1, 2, 4%')
      .eq('status', 'denied');
    
    if (error) {
      console.error('❌ Error finding transfers:', error.message);
      return;
    }
    
    console.log(`📊 Found ${data?.length || 0} denied transfers:`);
    
    if (data && data.length > 0) {
      data.forEach((transfer, index) => {
        console.log(`\n${index + 1}. Transfer ID: ${transfer.id}`);
        console.log(`   Size: ${transfer.size_class}`);
        console.log(`   Weight: ${transfer.quantity_kg}kg`);
        console.log(`   Pieces: ${transfer.quantity_pieces}`);
        console.log(`   From: ${transfer.storage_locations?.name || 'Unknown'}`);
        console.log(`   To: ${transfer.storage_locations?.name || 'Unknown'}`);
        console.log(`   Status: ${transfer.status}`);
        console.log(`   Created: ${transfer.created_at}`);
        console.log(`   Notes: ${transfer.notes}`);
      });
    } else {
      console.log('No denied transfers found matching the criteria.');
    }
    
    return data;
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

async function resetTransfersToPending(transferIds) {
  try {
    console.log('\n🔄 Resetting transfers to pending status...');
    
    const { data, error } = await supabase
      .from('transfers')
      .update({
        status: 'pending',
        approved_by: null,
        approved_at: null,
        updated_at: new Date().toISOString()
      })
      .in('id', transferIds);
    
    if (error) {
      console.error('❌ Error resetting transfers:', error.message);
      return false;
    }
    
    console.log(`✅ Successfully reset ${transferIds.length} transfers to pending status`);
    return true;
  } catch (error) {
    console.error('💥 Error:', error.message);
    return false;
  }
}

async function approveTransfers(transferIds, approvedBy = 'f5946671') {
  try {
    console.log('\n✅ Approving transfers...');
    
    const { data, error } = await supabase
      .from('transfers')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .in('id', transferIds);
    
    if (error) {
      console.error('❌ Error approving transfers:', error.message);
      return false;
    }
    
    console.log(`✅ Successfully approved ${transferIds.length} transfers`);
    return true;
  } catch (error) {
    console.error('💥 Error:', error.message);
    return false;
  }
}

async function deleteTransfers(transferIds) {
  try {
    console.log('\n🗑️ Deleting transfers...');
    
    const { data, error } = await supabase
      .from('transfers')
      .delete()
      .in('id', transferIds);
    
    if (error) {
      console.error('❌ Error deleting transfers:', error.message);
      return false;
    }
    
    console.log(`✅ Successfully deleted ${transferIds.length} transfers`);
    return true;
  } catch (error) {
    console.error('💥 Error:', error.message);
    return false;
  }
}

async function main() {
  console.log('🐟 Handling Denied Transfers for User f5946671\n');
  
  // Find the denied transfers
  const transfers = await findDeniedTransfers();
  
  if (!transfers || transfers.length === 0) {
    console.log('No transfers to handle.');
    return;
  }
  
  const transferIds = transfers.map(t => t.id);
  
  console.log('\n📋 Available actions:');
  console.log('1. Reset to pending status');
  console.log('2. Approve transfers');
  console.log('3. Delete transfers');
  console.log('4. Just show details (no action)');
  
  // For now, let's just show the details
  // You can uncomment the action you want to take:
  
  // Reset to pending:
  // await resetTransfersToPending(transferIds);
  
  // Approve transfers:
  // await approveTransfers(transferIds);
  
  // Delete transfers:
  // await deleteTransfers(transferIds);
  
  console.log('\n🎉 Transfer handling completed!');
}

// Run the script
main().catch(console.error);
