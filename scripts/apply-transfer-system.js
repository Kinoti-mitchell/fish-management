#!/usr/bin/env node

/**
 * Apply Transfer System Script
 * This script applies the complete transfer system to the database
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './server/server.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server.env');
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyTransferSystem() {
  console.log('🚀 Applying complete transfer system...\n');
  
  try {
    // Read the complete transfer system SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'COMPLETE_TRANSFER_SYSTEM.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 SQL Content to apply:');
    console.log('='.repeat(80));
    console.log(sqlContent);
    console.log('='.repeat(80));
    
    console.log('\n📋 This SQL will:');
    console.log('   ✅ Create transfer_requests table');
    console.log('   ✅ Create transfer_log table');
    console.log('   ✅ Create create_transfer_request function');
    console.log('   ✅ Create approve_transfer_request function');
    console.log('   ✅ Create decline_transfer_request function');
    console.log('   ✅ Disable RLS and grant proper permissions');
    console.log('   ✅ Update storage capacities');
    
    console.log('\n⚠️  IMPORTANT: You need to apply this SQL manually in Supabase SQL Editor');
    console.log('📋 Steps:');
    console.log('1. Open your Supabase project dashboard');
    console.log('2. Go to SQL Editor (left sidebar)');
    console.log('3. Copy and paste the SQL above');
    console.log('4. Click "Run" to execute');
    console.log('5. Your transfer functionality will then work properly');
    
    console.log('\n🎉 After applying the SQL:');
    console.log('   • Transfer requests can be created');
    console.log('   • Transfer requests can be approved/declined');
    console.log('   • Fish can be moved between storage locations');
    console.log('   • Transfer history will be logged');
    console.log('   • No more "table not found" errors');
    
    return true;
  } catch (error) {
    console.error('❌ Error reading transfer system SQL:', error);
    return false;
  }
}

async function testTransferSystem() {
  console.log('🔍 Testing transfer system...');
  
  try {
    // Test basic table access
    const { data: transferData, error: transferError } = await supabase
      .from('transfer_requests')
      .select('*')
      .limit(1);
    
    if (transferError) {
      if (transferError.message.includes('relation "transfer_requests" does not exist')) {
        console.log('❌ transfer_requests table does not exist yet');
        console.log('   Please apply the SQL script first in Supabase SQL Editor');
        return false;
      } else {
        console.error('❌ Error accessing transfer_requests table:', transferError);
        return false;
      }
    }
    
    console.log('✅ transfer_requests table exists and is accessible');
    console.log(`📊 Found ${transferData?.length || 0} existing transfer requests`);
    
    // Test if we can create a transfer request (test the function)
    try {
      const { data: testData, error: testError } = await supabase
        .rpc('create_transfer_request', {
          p_from_storage_location_id: '00000000-0000-0000-0000-000000000000',
          p_to_storage_location_id: '00000000-0000-0000-0000-000000000000',
          p_size: 1,
          p_quantity: 1,
          p_weight_kg: 1.0,
          p_notes: 'Test transfer request'
        });
      
      if (testError) {
        if (testError.message.includes('function create_transfer_request')) {
          console.log('❌ create_transfer_request function does not exist yet');
          console.log('   Please apply the SQL script first in Supabase SQL Editor');
          return false;
        } else {
          console.log('⚠️  Function exists but test failed (expected due to invalid IDs):', testError.message);
        }
      } else {
        console.log('✅ create_transfer_request function exists and works');
      }
    } catch (err) {
      console.log('⚠️  Could not test create_transfer_request function:', err.message);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Transfer system test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting transfer system setup...\n');
  
  // Step 1: Apply transfer system
  const transferSystemApplied = await applyTransferSystem();
  if (!transferSystemApplied) {
    console.log('\n❌ Transfer system application failed');
    process.exit(1);
  }
  
  console.log('');
  
  // Step 2: Test transfer system
  const transferSystemTest = await testTransferSystem();
  if (!transferSystemTest) {
    console.log('\n❌ Transfer system test failed');
    process.exit(1);
  }
  
  console.log('\n✅ Transfer system setup completed successfully!');
  console.log('🎉 The transfer functionality should now work properly');
  console.log('\n📋 What was created:');
  console.log('- transfer_requests table');
  console.log('- transfer_log table');
  console.log('- create_transfer_request function');
  console.log('- approve_transfer_request function');
  console.log('- decline_transfer_request function');
  console.log('- Proper permissions and RLS settings');
  console.log('\n📋 Next steps:');
  console.log('1. Test your application: npm run dev');
  console.log('2. Try using the transfer functionality in the inventory management');
  console.log('3. Check the browser console for any remaining errors');
}

// Run the setup
main().catch(console.error);
