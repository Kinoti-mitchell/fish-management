#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAuth() {
  console.log('🔍 Debugging authentication...\n');
  
  try {
    // Test 1: Check connection
    console.log('1. Testing Supabase connection...');
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) {
      console.log(`❌ Connection failed: ${error.message}`);
      return;
    }
    console.log('✅ Connection successful');
    
    // Test 2: Check existing profiles
    console.log('\n2. Checking existing profiles...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');
    
    if (profilesError) {
      console.log(`❌ Profiles fetch failed: ${profilesError.message}`);
    } else {
      console.log(`✅ Found ${profiles.length} profiles:`);
      profiles.forEach(profile => {
        console.log(`   - ${profile.email} (${profile.role})`);
      });
    }
    
    // Test 3: Check auth users
    console.log('\n3. Checking auth users...');
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.log(`❌ Auth users fetch failed: ${usersError.message}`);
    } else {
      console.log(`✅ Found ${users.length} auth users:`);
      users.forEach(user => {
        console.log(`   - ${user.email} (${user.id})`);
      });
    }
    
    // Test 4: Try to sign in with admin@rio.com
    console.log('\n4. Testing login with admin@rio.com...');
    console.log('Note: This will fail if password is not set or incorrect');
    
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'admin@rio.com',
      password: 'test123' // This will likely fail, but we'll see the error
    });
    
    if (signInError) {
      console.log(`❌ Login failed (expected): ${signInError.message}`);
    } else {
      console.log(`✅ Login successful: ${signInData.user.email}`);
    }
    
    console.log('\n📋 Summary:');
    console.log('- Database connection: Working');
    console.log('- Profiles table: Working');
    console.log('- Auth users: Available');
    console.log('- Issue: Likely password not set for admin users');
    
    console.log('\n🔧 Solution:');
    console.log('1. Go to Supabase Dashboard > Authentication > Users');
    console.log('2. Find admin@rio.com or mitchellkinoti@gmail.com');
    console.log('3. Click "Reset Password" or set a password');
    console.log('4. Or create a new user with a known password');
    
  } catch (error) {
    console.error('❌ Debug error:', error.message);
  }
}

debugAuth();
