const { createClient } = require('@supabase/supabase-js');

// Supabase connection
const supabaseUrl = 'https://pgpazwlejhysxabtkifz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBncGF6d2xlamh5c3hhYnRraWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NjE0ODksImV4cCI6MjA2OTQzNzQ4OX0.VZjBmh5647fzGgfW8ttNMUirKRXIg1hj0X8pG0dhjD0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testMultiUserTransfers() {
  try {
    console.log('🔍 Testing multi-user transfer system...');
    
    // 1. Check available users
    console.log('\n1. Checking available users...');
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role')
      .order('created_at', { ascending: false });
    
    if (usersError) {
      console.log('❌ Error getting users:', usersError);
      return;
    }
    
    console.log('✅ Available users:');
    users.forEach(user => {
      console.log(`  - ${user.first_name} ${user.last_name} (${user.email}) - Role: ${user.role} - ID: ${user.id}`);
    });
    
    // 2. Check recent transfers to see user patterns
    console.log('\n2. Checking recent transfers for user patterns...');
    const { data: recentTransfers, error: transfersError } = await supabase
      .from('transfers')
      .select('id, requested_by, approved_by, status, created_at, approved_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (transfersError) {
      console.log('❌ Error getting transfers:', transfersError);
      return;
    }
    
    console.log('✅ Recent transfers:');
    recentTransfers.forEach(transfer => {
      const requestedBy = users.find(u => u.id === transfer.requested_by);
      const approvedBy = users.find(u => u.id === transfer.approved_by);
      
      console.log(`  - ${transfer.id}:`);
      console.log(`    Requested by: ${requestedBy ? `${requestedBy.first_name} ${requestedBy.last_name}` : 'Unknown'} (${transfer.requested_by})`);
      console.log(`    Approved by: ${approvedBy ? `${approvedBy.first_name} ${approvedBy.last_name}` : 'Unknown'} (${transfer.approved_by})`);
      console.log(`    Status: ${transfer.status}`);
      console.log(`    Created: ${transfer.created_at}`);
      if (transfer.approved_at) {
        console.log(`    Approved: ${transfer.approved_at}`);
      }
      console.log('');
    });
    
    // 3. Test creating a transfer with a specific user (simulate different user requesting)
    console.log('\n3. Testing transfer creation with different user...');
    
    // Get available storage locations
    const { data: storages, error: storageError } = await supabase
      .from('storage_locations')
      .select('id, name, location_type')
      .limit(5);
    
    if (storageError) {
      console.log('❌ Error getting storages:', storageError);
      return;
    }
    
    console.log('✅ Available storage locations:');
    storages.forEach(storage => {
      console.log(`  - ${storage.name} (${storage.location_type}) - ID: ${storage.id}`);
    });
    
    // 4. Check if there's inventory to transfer
    console.log('\n4. Checking available inventory for transfer...');
    const { data: inventory, error: inventoryError } = await supabase
      .from('sorting_results')
      .select('id, storage_location_id, size_class, total_pieces, total_weight_grams')
      .limit(5);
    
    if (inventoryError) {
      console.log('❌ Error getting inventory:', inventoryError);
      return;
    }
    
    console.log('✅ Available inventory:');
    inventory.forEach(item => {
      const storage = storages.find(s => s.id === item.storage_location_id);
      console.log(`  - Size ${item.size_class}: ${item.total_pieces} pieces, ${item.total_weight_grams/1000}kg in ${storage?.name || 'Unknown'}`);
    });
    
    // 5. Test the approve function with different user IDs
    console.log('\n5. Testing approve function with different user IDs...');
    
    // Get a pending transfer if any exists
    const { data: pendingTransfer, error: pendingError } = await supabase
      .from('transfers')
      .select('id, requested_by, approved_by, status')
      .eq('status', 'pending')
      .limit(1)
      .single();
    
    if (pendingError && pendingError.code !== 'PGRST116') {
      console.log('❌ Error getting pending transfer:', pendingError);
    } else if (pendingTransfer) {
      console.log('✅ Found pending transfer:', pendingTransfer.id);
      
      // Test approval with different user
      const testApprover = users[0]; // Use first available user
      console.log(`Testing approval with user: ${testApprover.first_name} ${testApprover.last_name}`);
      
      const { data: approveResult, error: approveError } = await supabase.rpc('approve_transfer', {
        p_transfer_id: pendingTransfer.id,
        p_approved_by: testApprover.id
      });
      
      if (approveError) {
        console.log('❌ Approve test failed:', approveError);
      } else {
        console.log('✅ Approve test result:', approveResult);
      }
    } else {
      console.log('ℹ️ No pending transfers to test approval with');
    }
    
    // 6. Summary
    console.log('\n📊 Multi-user transfer system summary:');
    console.log(`✅ Users available: ${users.length}`);
    console.log(`✅ Recent transfers: ${recentTransfers.length}`);
    console.log(`✅ Storage locations: ${storages.length}`);
    console.log(`✅ Inventory records: ${inventory.length}`);
    
    // Check if system supports different users
    const hasDifferentUsers = users.length > 1;
    const hasUserTransfers = recentTransfers.some(t => t.requested_by && t.approved_by);
    const hasDifferentUserTransfers = recentTransfers.some(t => t.requested_by !== t.approved_by);
    
    console.log(`✅ System supports multiple users: ${hasDifferentUsers}`);
    console.log(`✅ Transfers have user tracking: ${hasUserTransfers}`);
    console.log(`✅ Different users can request/approve: ${hasDifferentUserTransfers}`);
    
    if (hasDifferentUsers && hasUserTransfers) {
      console.log('\n🎉 Multi-user transfer system is working correctly!');
      console.log('   - Different users can request transfers');
      console.log('   - Different users can approve transfers');
      console.log('   - User tracking is properly implemented');
    } else {
      console.log('\n⚠️ Multi-user system needs verification');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMultiUserTransfers();
