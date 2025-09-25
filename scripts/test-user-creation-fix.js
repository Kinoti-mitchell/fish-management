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

const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const regularSupabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUserCreationFix() {
  console.log('🔧 Testing user creation with manual profile creation...\n');
  
  const testUser = {
    email: `manual-test-${Date.now()}@riofish.com`,
    password: 'test123',
    first_name: 'Manual',
    last_name: 'Test',
    role: 'processor',
    phone: '+254700000999'
  };
  
  try {
    // Step 1: Create user in Supabase Auth (this might fail due to trigger)
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
      console.log(`❌ Auth creation failed: ${authError.message}`);
      console.log('   This confirms the trigger is causing issues');
      
      // Try alternative approach - create profile first, then auth user
      console.log('\n🔄 Trying alternative approach...');
      return await testAlternativeApproach(testUser);
    } else {
      console.log('✅ User created in Supabase Auth');
      console.log(`   Auth ID: ${authData.user.id}`);
      
      // Step 2: Manually create profile (in case trigger failed)
      console.log('\n2️⃣ Creating profile manually...');
      const profileData = {
        id: authData.user.id,
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
        .upsert(profileData, { onConflict: 'id' });

      if (profileError) {
        console.log(`❌ Profile creation failed: ${profileError.message}`);
        return { success: false, error: profileError.message };
      } else {
        console.log('✅ Profile created successfully');
      }

      // Step 3: Test login
      console.log('\n3️⃣ Testing login...');
      const { data: loginData, error: loginError } = await regularSupabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password,
      });

      if (loginError) {
        console.log(`❌ Login failed: ${loginError.message}`);
        return { success: false, error: loginError.message };
      } else {
        console.log('✅ Login successful!');
        console.log(`   Logged in as: ${loginData.user.email}`);
        
        // Clean up
        await regularSupabase.auth.signOut();
        await adminSupabase.auth.admin.deleteUser(authData.user.id);
        console.log('   ✅ Test user cleaned up');
        
        return { success: true };
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testAlternativeApproach(testUser) {
  console.log('🔄 Alternative approach: Create profile first, then auth user...');
  
  try {
    // Generate a UUID for the profile
    const profileId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Step 1: Create profile first
    console.log('1️⃣ Creating profile first...');
    const profileData = {
      id: profileId,
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
      .insert(profileData);

    if (profileError) {
      console.log(`❌ Profile creation failed: ${profileError.message}`);
      return { success: false, error: profileError.message };
    } else {
      console.log('✅ Profile created successfully');
    }

    // Step 2: Try to create auth user with the same ID
    console.log('2️⃣ Creating auth user with matching ID...');
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
      console.log(`❌ Auth creation still failed: ${authError.message}`);
      console.log('   The issue is likely with the database trigger');
      
      // Clean up profile
      await adminSupabase.from('profiles').delete().eq('id', profileId);
      return { success: false, error: authError.message };
    } else {
      console.log('✅ Auth user created successfully');
      
      // Step 3: Test login
      console.log('3️⃣ Testing login...');
      const { data: loginData, error: loginError } = await regularSupabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password,
      });

      if (loginError) {
        console.log(`❌ Login failed: ${loginError.message}`);
        return { success: false, error: loginError.message };
      } else {
        console.log('✅ Login successful!');
        console.log(`   Logged in as: ${loginData.user.email}`);
        
        // Clean up
        await regularSupabase.auth.signOut();
        await adminSupabase.auth.admin.deleteUser(authData.user.id);
        await adminSupabase.from('profiles').delete().eq('id', profileId);
        console.log('   ✅ Test user cleaned up');
        
        return { success: true };
      }
    }
    
  } catch (error) {
    console.error('❌ Alternative approach failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  const result = await testUserCreationFix();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULT');
  console.log('='.repeat(60));
  
  if (result.success) {
    console.log('✅ User creation and login works!');
    console.log('✅ New users will be able to log in');
    console.log('✅ The system is working correctly');
  } else {
    console.log('❌ User creation has issues');
    console.log(`❌ Error: ${result.error}`);
    console.log('\n🔧 SOLUTION NEEDED:');
    console.log('The database trigger is causing issues. You need to:');
    console.log('1. Go to Supabase Dashboard > SQL Editor');
    console.log('2. Run this SQL to fix the trigger:');
    console.log(`
-- Fix the handle_new_user function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, first_name, last_name, role, is_active, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
        COALESCE(NEW.raw_user_meta_data->>'last_name', 'Name'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'viewer'),
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the user creation
        RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
  }
}

main();
