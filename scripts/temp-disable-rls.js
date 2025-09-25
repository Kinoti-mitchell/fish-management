#!/usr/bin/env node

/**
 * Temporary RLS Disable Script
 * This script temporarily disables RLS to fix permission issues
 * WARNING: Only use this for development/testing!
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/server.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function disableRLS() {
  console.log('⚠️  WARNING: This will temporarily disable RLS for development!');
  console.log('🔧 Disabling RLS on key tables...');
  
  try {
    // Disable RLS on profiles table
    const { error: profilesError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;'
    });
    
    if (profilesError) {
      console.log('⚠️  Could not disable RLS on profiles (might already be disabled):', profilesError.message);
    } else {
      console.log('✅ RLS disabled on profiles table');
    }
    
    // Disable RLS on user_roles table
    const { error: rolesError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;'
    });
    
    if (rolesError) {
      console.log('⚠️  Could not disable RLS on user_roles (might already be disabled):', rolesError.message);
    } else {
      console.log('✅ RLS disabled on user_roles table');
    }
    
    // Disable RLS on user_sessions table
    const { error: sessionsError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY;'
    });
    
    if (sessionsError) {
      console.log('⚠️  Could not disable RLS on user_sessions (might already be disabled):', sessionsError.message);
    } else {
      console.log('✅ RLS disabled on user_sessions table');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error disabling RLS:', error);
    return false;
  }
}

async function createTestData() {
  console.log('👤 Creating test data...');
  
  try {
    // Create a test admin profile
    const { data: adminProfile, error: adminError } = await supabase
      .from('profiles')
      .upsert([{
        id: '1a31181e-9b3d-4928-8349-f5b38466e5fb',
        email: 'admin@riofish.com',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin',
        is_active: true,
        phone: '',
        last_login: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select();
    
    if (adminError) {
      console.error('❌ Error creating admin profile:', adminError);
      return false;
    }
    
    console.log('✅ Test admin profile created');
    
    // Create default roles
    const defaultRoles = [
      {
        name: 'admin',
        display_name: 'Administrator',
        description: 'Full system access and control',
        permissions: ['*'],
        icon: 'Crown',
        color: 'bg-red-100 text-red-800 border-red-200',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        name: 'processor',
        display_name: 'Fish Processor',
        description: 'Manages fish processing operations',
        permissions: ['read:inventory', 'write:processing', 'read:orders', 'write:dispatch'],
        icon: 'Package',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        name: 'warehouse_manager',
        display_name: 'Warehouse Manager',
        description: 'Oversees warehouse operations',
        permissions: ['read:inventory', 'write:inventory', 'read:logistics', 'write:logistics'],
        icon: 'Package',
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        name: 'outlet_manager',
        display_name: 'Outlet Manager',
        description: 'Manages retail outlets and sales',
        permissions: ['read:sales', 'write:sales', 'read:customers', 'write:customers', 'read:inventory'],
        icon: 'Building',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        name: 'viewer',
        display_name: 'Viewer',
        description: 'Read-only access to system data',
        permissions: ['read:basic'],
        icon: 'Eye',
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .upsert(defaultRoles, { onConflict: 'name' })
      .select();
    
    if (rolesError) {
      console.error('❌ Error creating default roles:', rolesError);
      return false;
    }
    
    console.log('✅ Default user roles created');
    return true;
  } catch (error) {
    console.error('❌ Error creating test data:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting temporary RLS disable process...\n');
  console.log('⚠️  WARNING: This is for development only! Do not use in production!\n');
  
  // Step 1: Disable RLS
  const rlsDisabled = await disableRLS();
  if (!rlsDisabled) {
    console.log('\n❌ Failed to disable RLS');
    process.exit(1);
  }
  
  console.log('');
  
  // Step 2: Create test data
  const testDataCreated = await createTestData();
  if (!testDataCreated) {
    console.log('\n❌ Failed to create test data');
    process.exit(1);
  }
  
  console.log('\n✅ Temporary fix completed successfully!');
  console.log('🎉 Your application should now work without permission errors');
  console.log('\n📋 Next steps:');
  console.log('1. Test your application - it should load without errors');
  console.log('2. Try logging in with admin@riofish.com');
  console.log('3. Once everything works, re-enable RLS with proper policies');
  console.log('\n⚠️  Remember: RLS is disabled for development only!');
}

// Run the fix
main().catch(console.error);
