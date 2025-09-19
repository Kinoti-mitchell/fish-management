#!/usr/bin/env node

/**
 * Reset Supabase User Password
 * This script resets the password for an existing user
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/server.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server.env');
  process.exit(1);
}

// Use service role key to manage users
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetUserPassword() {
  console.log('🚀 Resetting user password...\n');
  
  try {
    // First, let's list users to find the admin user
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return false;
    }
    
    console.log(`📋 Found ${users.users.length} users in the system`);
    
    // Find the admin user
    const adminUser = users.users.find(user => user.email === 'admin@riofish.com');
    
    if (!adminUser) {
      console.error('❌ Admin user not found');
      return false;
    }
    
    console.log('👤 Found admin user:', adminUser.email);
    console.log('🆔 User ID:', adminUser.id);
    
    // Reset the password
    const { data, error } = await supabase.auth.admin.updateUserById(adminUser.id, {
      password: 'admin123',
      email_confirm: true
    });

    if (error) {
      console.error('❌ Error updating user password:', error);
      return false;
    }

    console.log('✅ Password reset successfully!');
    console.log('👤 Updated user:', data.user.email);
    
    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

async function testLogin() {
  console.log('\n🔍 Testing login...');
  
  try {
    // Test login with the reset password
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'admin@riofish.com',
      password: 'admin123'
    });

    if (error) {
      console.error('❌ Login test failed:', error);
      return false;
    }

    console.log('✅ Login test successful!');
    console.log('👤 Logged in user:', data.user.email);
    console.log('🔑 Session token:', data.session?.access_token?.substring(0, 20) + '...');
    
    return true;
  } catch (error) {
    console.error('❌ Login test error:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting password reset process...\n');
  
  // Step 1: Reset password
  const passwordReset = await resetUserPassword();
  if (!passwordReset) {
    console.log('\n❌ Password reset failed');
    process.exit(1);
  }
  
  // Step 2: Test login
  const loginTest = await testLogin();
  if (!loginTest) {
    console.log('\n❌ Login test failed');
    process.exit(1);
  }
  
  console.log('\n🎉 Success! Your Supabase user is ready!');
  console.log('\n📋 Login credentials:');
  console.log('Email: admin@riofish.com');
  console.log('Password: admin123');
  console.log('\n📋 Next steps:');
  console.log('1. Go to your application: http://localhost:3000');
  console.log('2. Login with the credentials above');
  console.log('3. You should now be able to access the dashboard');
}

// Run the script
main().catch(console.error);
