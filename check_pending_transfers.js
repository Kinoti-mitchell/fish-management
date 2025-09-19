// Script to check pending transfers in your database
// Run this with: node check_pending_transfers.js

const { createClient } = require('@supabase/supabase-js');

// You'll need to add your Supabase URL and key here
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPendingTransfers() {
  try {
    console.log('🔍 Checking pending transfers in your database...\n');

    // 1. Count all pending transfers
    const { data: pendingCount, error: countError } = await supabase
      .from('transfers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (countError) {
      console.error('❌ Error counting pending transfers:', countError);
      return;
    }

    console.log(`📊 Total pending transfers: ${pendingCount?.length || 0}\n`);

    // 2. Get all pending transfers with details
    const { data: pendingTransfers, error: pendingError } = await supabase
      .from('transfers')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (pendingError) {
      console.error('❌ Error fetching pending transfers:', pendingError);
      return;
    }

    console.log('📋 Pending transfers details:');
    if (pendingTransfers && pendingTransfers.length > 0) {
      pendingTransfers.forEach((transfer, index) => {
        console.log(`\n${index + 1}. Transfer ID: ${transfer.id}`);
        console.log(`   From: ${transfer.from_storage_name || 'Unknown'}`);
        console.log(`   To: ${transfer.to_storage_name || 'Unknown'}`);
        console.log(`   Size: ${transfer.size_class}`);
        console.log(`   Quantity: ${transfer.quantity}`);
        console.log(`   Weight: ${transfer.weight_kg}kg`);
        console.log(`   Notes: ${transfer.notes || 'None'}`);
        console.log(`   Created: ${new Date(transfer.created_at).toLocaleString()}`);
        console.log(`   Requested by: ${transfer.requested_by || 'System'}`);
      });
    } else {
      console.log('   No pending transfers found.');
    }

    // 3. Get status breakdown
    const { data: statusBreakdown, error: statusError } = await supabase
      .from('transfers')
      .select('status')
      .order('status');

    if (statusError) {
      console.error('❌ Error fetching status breakdown:', statusError);
      return;
    }

    console.log('\n📊 Transfer status breakdown:');
    const statusCounts = {};
    statusBreakdown?.forEach(transfer => {
      statusCounts[transfer.status] = (statusCounts[transfer.status] || 0) + 1;
    });

    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    // 4. Get recent transfers
    const { data: recentTransfers, error: recentError } = await supabase
      .from('transfers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentError) {
      console.error('❌ Error fetching recent transfers:', recentError);
      return;
    }

    console.log('\n📋 Recent transfers (last 5):');
    if (recentTransfers && recentTransfers.length > 0) {
      recentTransfers.forEach((transfer, index) => {
        console.log(`\n${index + 1}. ${transfer.status.toUpperCase()} - ${transfer.from_storage_name} → ${transfer.to_storage_name}`);
        console.log(`   Size ${transfer.size_class}, ${transfer.quantity} pieces, ${transfer.weight_kg}kg`);
        console.log(`   Created: ${new Date(transfer.created_at).toLocaleString()}`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the check
checkPendingTransfers();
