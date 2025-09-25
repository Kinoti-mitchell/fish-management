#!/usr/bin/env node

/**
 * Create Supabase User
 * This script creates a real user account in Supabase Auth
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/server.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server.env');
  process.exit(1);
}

// Use service role key to create users
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createUser() {
  console.log('🚀 Creating Supabase user account...\n');
  
  try {
    // Create user with admin email
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'admin@riofish.com',
      password: 'admin123',
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin'
      }
    });

    if (error) {
      console.error('❌ Error creating user:', error);
      
      // If user already exists, try to update password
      if (error.message.includes('already registered')) {
        console.log('👤 User already exists, updating password...');
        
        const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
          data?.user?.id || '1a31181e-9b3d-4928-8349-f5b38466e5fb',
          {
            password: 'admin123',
            email_confirm: true
          }
        );
        
        if (updateError) {
          console.error('❌ Error updating user:', updateError);
          return false;
        }
        
        console.log('✅ User password updated successfully');
        console.log('👤 User details:', updateData.user);
        return true;
      }
      
      return false;
    }

    console.log('✅ User created successfully!');
    console.log('👤 User details:', data.user);
    console.log('\n📋 Login credentials:');
    console.log('Email: admin@riofish.com');
    console.log('Password: admin123');
    
    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

async function testLogin() {
  console.log('\n🔍 Testing login...');
  
  try {
    // Test login with the created user
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
  console.log('🚀 Starting Supabase user creation process...\n');
  
  // Step 1: Create user
  const userCreated = await createUser();
  if (!userCreated) {
    console.log('\n❌ User creation failed');
    process.exit(1);
  }
  
  // Step 2: Test login
  const loginTest = await testLogin();
  if (!loginTest) {
    console.log('\n❌ Login test failed');
    process.exit(1);
  }
  
  console.log('\n🎉 Success! Your Supabase user is ready!');
  console.log('\n📋 Next steps:');
  console.log('1. Go to your application: http://localhost:3000');
  console.log('2. Login with: admin@riofish.com / admin123');
  console.log('3. You should now be able to access the dashboard');
}

// Run the script
main().catch(console.error);
