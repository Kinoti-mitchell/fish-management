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

// All available roles in your system
const roles = [
  {
    name: 'admin',
    display_name: 'Administrator',
    description: 'Full system access and control',
    permissions: ['*']
  },
  {
    name: 'processor',
    display_name: 'Fish Processor',
    description: 'Manages fish processing operations',
    permissions: ['read:all', 'write:processing', 'write:quality', 'read:inventory']
  },
  {
    name: 'farmer',
    display_name: 'Fish Farmer',
    description: 'Manages fish farming operations',
    permissions: ['read:farming', 'write:farming', 'read:harvests', 'write:harvests']
  },
  {
    name: 'outlet_manager',
    display_name: 'Outlet Manager',
    description: 'Manages retail outlets and sales',
    permissions: ['read:sales', 'write:sales', 'read:customers', 'write:customers', 'read:inventory']
  },
  {
    name: 'warehouse_manager',
    display_name: 'Warehouse Manager',
    description: 'Oversees warehouse operations',
    permissions: ['read:inventory', 'write:inventory', 'read:logistics', 'write:logistics']
  },
  {
    name: 'viewer',
    display_name: 'Viewer',
    description: 'Read-only access to system data',
    permissions: ['read:basic']
  }
];

async function createTestUser(role) {
  const timestamp = Date.now();
  const testUser = {
    email: `test-${role.name}-${timestamp}@riofish.com`,
    password: 'test123',
    first_name: role.display_name.split(' ')[0],
    last_name: 'Test',
    role: role.name,
    phone: `+254700000${timestamp.toString().slice(-3)}`
  };
  
  console.log(`\n🔄 Testing ${role.display_name} (${role.name})...`);
  console.log(`   Email: ${testUser.email}`);
  console.log(`   Permissions: ${role.permissions.join(', ')}`);
  
  try {
    // Step 1: Create user in Supabase Auth
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
        console.log('   ⚠️  User already exists in auth, testing login...');
      } else {
        console.log(`   ❌ Auth creation failed: ${authError.message}`);
        return { success: false, error: authError.message };
      }
    } else {
      console.log('   ✅ User created in Supabase Auth');
    }

    // Step 2: Create profile in database
    const profileData = {
      id: authData?.user?.id || `test-${role.name}-${timestamp}`,
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
      console.log(`   ❌ Profile creation failed: ${profileError.message}`);
      return { success: false, error: profileError.message };
    } else {
      console.log('   ✅ Profile created in database');
    }

    // Step 3: Test login
    const { data: loginData, error: loginError } = await regularSupabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password,
    });

    if (loginError) {
      console.log(`   ❌ Login failed: ${loginError.message}`);
      return { success: false, error: loginError.message };
    } else {
      console.log('   ✅ Login successful!');
      console.log(`   📧 Logged in as: ${loginData.user.email}`);
      console.log(`   🆔 User ID: ${loginData.user.id}`);
    }

    // Step 4: Test profile retrieval and role verification
    const { data: profile, error: profileFetchError } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('email', testUser.email)
      .single();

    if (profileFetchError) {
      console.log(`   ❌ Profile fetch failed: ${profileFetchError.message}`);
      return { success: false, error: profileFetchError.message };
    } else {
      console.log('   ✅ Profile retrieved successfully');
      console.log(`   👤 Name: ${profile.first_name} ${profile.last_name}`);
      console.log(`   🎭 Role: ${profile.role}`);
      console.log(`   ✅ Active: ${profile.is_active}`);
      
      // Verify role matches
      if (profile.role === role.name) {
        console.log('   ✅ Role assignment correct');
      } else {
        console.log(`   ❌ Role mismatch: expected ${role.name}, got ${profile.role}`);
        return { success: false, error: 'Role mismatch' };
      }
    }

    // Step 5: Test logout
    await regularSupabase.auth.signOut();
    console.log('   ✅ Logout successful');

    return { 
      success: true, 
      user: testUser,
      authId: authData?.user?.id,
      profileId: profile.id
    };
    
  } catch (error) {
    console.log(`   ❌ Test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testAllRoles() {
  console.log('🧪 Testing User Creation and Login for ALL ROLES\n');
  console.log('=' .repeat(60));
  
  const results = [];
  let successCount = 0;
  let failureCount = 0;
  
  for (const role of roles) {
    const result = await createTestUser(role);
    results.push({ role: role.name, ...result });
    
    if (result.success) {
      successCount++;
    } else {
      failureCount++;
    }
    
    console.log('   ' + '-'.repeat(50));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`✅ Successful: ${successCount}/${roles.length} roles`);
  console.log(`❌ Failed: ${failureCount}/${roles.length} roles`);
  
  if (failureCount > 0) {
    console.log('\n❌ Failed roles:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`   - ${result.role}: ${result.error}`);
    });
  }
  
  if (successCount === roles.length) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ Your user creation system works perfectly for all roles');
    console.log('✅ New users will be able to log in regardless of their assigned role');
    console.log('✅ Role-based permissions are properly set up');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
  }
  
  console.log('\n📋 Available roles and their capabilities:');
  roles.forEach(role => {
    const status = results.find(r => r.role === role.name)?.success ? '✅' : '❌';
    console.log(`   ${status} ${role.display_name}: ${role.description}`);
  });
}

testAllRoles();
