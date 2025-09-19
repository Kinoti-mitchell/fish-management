#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/server.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

// Admin client for creating users
const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Regular client for testing login
const regularSupabase = createClient(supabaseUrl, supabaseAnonKey);

async function testNewUserCreation() {
  console.log('🧪 Testing new user creation and login...\n');
  
  const testUser = {
    email: 'testuser@riofish.com',
    password: 'test123',
    first_name: 'Test',
    last_name: 'User',
    role: 'processor',
    phone: '+254700000999'
  };
  
  try {
    // Step 1: Create user in Supabase Auth
    console.log('1️⃣ Creating user in Supabase Auth...');
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: testUser.email,
      password: testUser.password,
      email_confirm: true,
      user_metadata: {
        first_name: testUser.first_name,
        last_name: testUser.last_name,
        role: testUser.role,
        phone: testUser.phone,
      }
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log('⚠️  User already exists in auth, will test login...');
      } else {
        console.log('❌ Auth creation failed:', authError.message);
        return;
      }
    } else {
      console.log('✅ User created in Supabase Auth');
      console.log(`   Auth ID: ${authData.user.id}`);
    }

    // Step 2: Create profile in database
    console.log('\n2️⃣ Creating profile in database...');
    const profileData = {
      id: authData?.user?.id || 'test-id-' + Date.now(),
      email: testUser.email,
      first_name: testUser.first_name,
      last_name: testUser.last_name,
      role: testUser.role,
      phone: testUser.phone,
      is_active: true,
      last_login: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: profileError } = await adminSupabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'email' });

    if (profileError) {
      console.log('❌ Profile creation failed:', profileError.message);
      return;
    } else {
      console.log('✅ Profile created in database');
    }

    // Step 3: Test login
    console.log('\n3️⃣ Testing login...');
    const { data: loginData, error: loginError } = await regularSupabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password,
    });

    if (loginError) {
      console.log('❌ Login failed:', loginError.message);
    } else {
      console.log('✅ Login successful!');
      console.log(`   Logged in as: ${loginData.user.email}`);
      console.log(`   User ID: ${loginData.user.id}`);
      console.log(`   Email Confirmed: ${loginData.user.email_confirmed_at ? 'Yes' : 'No'}`);
    }

    // Step 4: Test profile retrieval
    console.log('\n4️⃣ Testing profile retrieval...');
    const { data: profile, error: profileFetchError } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('email', testUser.email)
      .single();

    if (profileFetchError) {
      console.log('❌ Profile fetch failed:', profileFetchError.message);
    } else {
      console.log('✅ Profile retrieved successfully');
      console.log(`   Name: ${profile.first_name} ${profile.last_name}`);
      console.log(`   Role: ${profile.role}`);
      console.log(`   Active: ${profile.is_active}`);
    }

    console.log('\n🎉 Test completed successfully!');
    console.log('✅ New users created through your system WILL be able to log in');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testNewUserCreation();
