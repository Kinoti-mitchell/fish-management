#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/server.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function debugUserCreation() {
  console.log('🔍 Debugging user creation issues...\n');
  
  try {
    // Test 1: Check if we can access auth admin functions
    console.log('1️⃣ Testing auth admin access...');
    try {
      const { data: users, error: usersError } = await adminSupabase.auth.admin.listUsers();
      if (usersError) {
        console.log(`❌ Cannot access auth admin: ${usersError.message}`);
        console.log('   This might be a permissions issue with the service role key');
      } else {
        console.log(`✅ Auth admin access working (${users.length} users found)`);
      }
    } catch (error) {
      console.log(`❌ Auth admin error: ${error.message}`);
    }
    
    // Test 2: Check database connection
    console.log('\n2️⃣ Testing database connection...');
    const { data: profiles, error: profilesError } = await adminSupabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (profilesError) {
      console.log(`❌ Database connection failed: ${profilesError.message}`);
    } else {
      console.log('✅ Database connection working');
    }
    
    // Test 3: Check user_roles table
    console.log('\n3️⃣ Checking user_roles table...');
    const { data: roles, error: rolesError } = await adminSupabase
      .from('user_roles')
      .select('*');
    
    if (rolesError) {
      console.log(`❌ User roles table error: ${rolesError.message}`);
    } else {
      console.log(`✅ User roles table working (${roles.length} roles found)`);
      roles.forEach(role => {
        console.log(`   - ${role.name}: ${role.display_name}`);
      });
    }
    
    // Test 4: Try creating a simple user with minimal data
    console.log('\n4️⃣ Testing minimal user creation...');
    const testEmail = `debug-test-${Date.now()}@riofish.com`;
    
    try {
      const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email: testEmail,
        password: 'test123',
        email_confirm: true
      });
      
      if (authError) {
        console.log(`❌ Minimal user creation failed: ${authError.message}`);
        console.log(`   Error code: ${authError.status}`);
        console.log(`   Error details:`, authError);
      } else {
        console.log('✅ Minimal user creation successful');
        console.log(`   User ID: ${authData.user.id}`);
        
        // Clean up
        await adminSupabase.auth.admin.deleteUser(authData.user.id);
        console.log('   ✅ Test user cleaned up');
      }
    } catch (error) {
      console.log(`❌ User creation exception: ${error.message}`);
    }
    
    // Test 5: Check Supabase project settings
    console.log('\n5️⃣ Checking project configuration...');
    console.log(`   Supabase URL: ${supabaseUrl}`);
    console.log(`   Service Key: ${supabaseServiceKey.substring(0, 20)}...`);
    
    // Test 6: Check if there are any RLS policies blocking
    console.log('\n6️⃣ Checking RLS policies...');
    const { data: policies, error: policiesError } = await adminSupabase
      .rpc('get_table_policies', { table_name: 'profiles' })
      .catch(() => ({ data: null, error: { message: 'Function not available' } }));
    
    if (policiesError) {
      console.log(`   RLS check: ${policiesError.message}`);
    } else {
      console.log(`   RLS policies: ${policies ? policies.length : 'Unknown'}`);
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error.message);
  }
}

debugUserCreation();
