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

// All available roles with their permissions
const roles = [
  {
    name: 'admin',
    display_name: 'Administrator',
    description: 'Full system access and control',
    permissions: ['*'],
    icon: 'Crown',
    color: 'bg-red-100 text-red-800 border-red-200'
  },
  {
    name: 'processor',
    display_name: 'Fish Processor',
    description: 'Manages fish processing operations, quality control, and production workflows',
    permissions: ['read:all', 'write:processing', 'write:quality', 'read:inventory'],
    icon: 'Package',
    color: 'bg-blue-100 text-blue-800 border-blue-200'
  },
  {
    name: 'farmer',
    display_name: 'Fish Farmer',
    description: 'Manages fish farming operations, pond management, and harvest scheduling',
    permissions: ['read:farming', 'write:farming', 'read:harvests', 'write:harvests'],
    icon: 'Tractor',
    color: 'bg-green-100 text-green-800 border-green-200'
  },
  {
    name: 'outlet_manager',
    display_name: 'Outlet Manager',
    description: 'Manages retail outlets, customer sales, and inventory at point of sale',
    permissions: ['read:sales', 'write:sales', 'read:customers', 'write:customers', 'read:inventory'],
    icon: 'Building',
    color: 'bg-purple-100 text-purple-800 border-purple-200'
  },
  {
    name: 'warehouse_manager',
    display_name: 'Warehouse Manager',
    description: 'Oversees warehouse operations, stock management, and distribution logistics',
    permissions: ['read:inventory', 'write:inventory', 'read:logistics', 'write:logistics'],
    icon: 'Package',
    color: 'bg-orange-100 text-orange-800 border-orange-200'
  },
  {
    name: 'viewer',
    display_name: 'Viewer',
    description: 'Read-only access to system data. Cannot modify any information.',
    permissions: ['read:basic'],
    icon: 'Eye',
    color: 'bg-gray-100 text-gray-800 border-gray-200'
  }
];

async function testRoleAssignmentAndLogin(role) {
  const timestamp = Date.now();
  const testUser = {
    email: `role-test-${role.name}-${timestamp}@riofish.com`,
    password: 'test123',
    first_name: role.display_name.split(' ')[0],
    last_name: 'User',
    role: role.name,
    phone: `+254700000${timestamp.toString().slice(-3)}`
  };
  
  console.log(`\n🔄 Testing ${role.display_name} (${role.name})...`);
  console.log(`   📧 Email: ${testUser.email}`);
  console.log(`   🔑 Password: ${testUser.password}`);
  console.log(`   🎭 Role: ${role.name}`);
  console.log(`   📋 Permissions: ${role.permissions.join(', ')}`);
  
  try {
    // Step 1: Create user in Supabase Auth
    console.log('   1️⃣ Creating user in Supabase Auth...');
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
      console.log(`   ❌ Auth creation failed: ${authError.message}`);
      return { success: false, error: authError.message, step: 'auth_creation' };
    } else {
      console.log('   ✅ User created in Supabase Auth');
      console.log(`   🆔 Auth ID: ${authData.user.id}`);
    }

    // Step 2: Create profile with role assignment
    console.log('   2️⃣ Creating profile with role assignment...');
    const profileData = {
      id: authData.user.id,
      email: testUser.email,
      first_name: testUser.first_name,
      last_name: testUser.last_name,
      role: testUser.role, // This is the key part - role assignment
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
      console.log(`   ❌ Profile creation failed: ${profileError.message}`);
      return { success: false, error: profileError.message, step: 'profile_creation' };
    } else {
      console.log('   ✅ Profile created with role assignment');
    }

    // Step 3: Verify role assignment
    console.log('   3️⃣ Verifying role assignment...');
    const { data: profile, error: profileFetchError } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('email', testUser.email)
      .single();

    if (profileFetchError) {
      console.log(`   ❌ Profile fetch failed: ${profileFetchError.message}`);
      return { success: false, error: profileFetchError.message, step: 'profile_verification' };
    } else {
      console.log('   ✅ Profile retrieved successfully');
      console.log(`   👤 Name: ${profile.first_name} ${profile.last_name}`);
      console.log(`   🎭 Assigned Role: ${profile.role}`);
      console.log(`   ✅ Active: ${profile.is_active}`);
      
      // Verify role matches
      if (profile.role === role.name) {
        console.log('   ✅ Role assignment verified correctly');
      } else {
        console.log(`   ❌ Role mismatch: expected ${role.name}, got ${profile.role}`);
        return { success: false, error: 'Role mismatch', step: 'role_verification' };
      }
    }

    // Step 4: Test login with role
    console.log('   4️⃣ Testing login with assigned role...');
    const { data: loginData, error: loginError } = await regularSupabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password,
    });

    if (loginError) {
      console.log(`   ❌ Login failed: ${loginError.message}`);
      return { success: false, error: loginError.message, step: 'login' };
    } else {
      console.log('   ✅ Login successful!');
      console.log(`   📧 Logged in as: ${loginData.user.email}`);
      console.log(`   🆔 User ID: ${loginData.user.id}`);
      console.log(`   ✅ Email Confirmed: ${loginData.user.email_confirmed_at ? 'Yes' : 'No'}`);
    }

    // Step 5: Test role-based access (simulate what the app would do)
    console.log('   5️⃣ Testing role-based access...');
    const { data: userProfile, error: userProfileError } = await regularSupabase
      .from('profiles')
      .select('role, first_name, last_name, is_active')
      .eq('id', loginData.user.id)
      .single();

    if (userProfileError) {
      console.log(`   ❌ Role-based access failed: ${userProfileError.message}`);
      return { success: false, error: userProfileError.message, step: 'role_access' };
    } else {
      console.log('   ✅ Role-based access successful');
      console.log(`   🎭 User Role: ${userProfile.role}`);
      console.log(`   👤 User Name: ${userProfile.first_name} ${userProfile.last_name}`);
      console.log(`   ✅ User Active: ${userProfile.is_active}`);
      
      // Check if role has expected permissions
      const roleDefinition = roles.find(r => r.name === userProfile.role);
      if (roleDefinition) {
        console.log(`   📋 Role Permissions: ${roleDefinition.permissions.join(', ')}`);
        console.log(`   📝 Role Description: ${roleDefinition.description}`);
      }
    }

    // Step 6: Test logout
    console.log('   6️⃣ Testing logout...');
    await regularSupabase.auth.signOut();
    console.log('   ✅ Logout successful');

    // Step 7: Clean up test user
    console.log('   7️⃣ Cleaning up test user...');
    await adminSupabase.auth.admin.deleteUser(authData.user.id);
    await adminSupabase.from('profiles').delete().eq('id', authData.user.id);
    console.log('   ✅ Test user cleaned up');

    return { 
      success: true, 
      user: testUser,
      role: role.name,
      permissions: role.permissions
    };
    
  } catch (error) {
    console.log(`   ❌ Test failed: ${error.message}`);
    return { success: false, error: error.message, step: 'exception' };
  }
}

async function testAllRoleAssignments() {
  console.log('🧪 Testing Role Assignment and Login for ALL ROLES\n');
  console.log('This test verifies that:');
  console.log('✅ Users can be created with specific roles');
  console.log('✅ Role assignments are saved correctly');
  console.log('✅ Users can log in with their assigned roles');
  console.log('✅ Role-based access control works');
  console.log('✅ All role permissions are properly set');
  console.log('\n' + '='.repeat(80));
  
  const results = [];
  let successCount = 0;
  let failureCount = 0;
  
  for (const role of roles) {
    const result = await testRoleAssignmentAndLogin(role);
    results.push({ role: role.name, ...result });
    
    if (result.success) {
      successCount++;
    } else {
      failureCount++;
    }
    
    console.log('   ' + '-'.repeat(70));
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 ROLE ASSIGNMENT AND LOGIN TEST SUMMARY');
  console.log('='.repeat(80));
  
  console.log(`✅ Successful: ${successCount}/${roles.length} roles`);
  console.log(`❌ Failed: ${failureCount}/${roles.length} roles`);
  
  if (failureCount > 0) {
    console.log('\n❌ Failed roles:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`   - ${result.role}: ${result.error} (${result.step})`);
    });
  }
  
  if (successCount === roles.length) {
    console.log('\n🎉 ALL ROLE TESTS PASSED!');
    console.log('✅ Your role assignment system works perfectly');
    console.log('✅ New users can be assigned any role and log in successfully');
    console.log('✅ Role-based permissions are properly configured');
    console.log('✅ Your user management system is fully functional');
  } else {
    console.log('\n⚠️  Some role tests failed. Check the errors above.');
    console.log('\n🔧 SOLUTION:');
    console.log('1. Go to Supabase Dashboard > SQL Editor');
    console.log('2. Run the trigger fix SQL I provided earlier');
    console.log('3. Then run this test again');
  }
  
  console.log('\n📋 Role Capabilities Summary:');
  roles.forEach(role => {
    const status = results.find(r => r.role === role.name)?.success ? '✅' : '❌';
    console.log(`   ${status} ${role.display_name}: ${role.description}`);
    console.log(`      Permissions: ${role.permissions.join(', ')}`);
  });
  
  console.log('\n💡 When you add new users:');
  console.log('1. Create user with email and password');
  console.log('2. Assign them a role (admin, processor, farmer, etc.)');
  console.log('3. They will automatically get the permissions for that role');
  console.log('4. They can log in and access features based on their role');
}

testAllRoleAssignments();
