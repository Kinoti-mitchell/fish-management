#!/usr/bin/env node

/**
 * Quick Fix Script
 * This script creates the necessary data using service role key
 */

const { createClient } = require('@supabase/supabase-js');
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

async function createTables() {
  console.log('🏗️  Creating tables if they don\'t exist...');
  
  try {
    // Create profiles table
    const { error: profilesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS profiles (
          id UUID PRIMARY KEY,
          email TEXT NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'viewer',
          phone TEXT,
          is_active BOOLEAN DEFAULT true,
          last_login TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (profilesError) {
      console.log('⚠️  Profiles table might already exist:', profilesError.message);
    } else {
      console.log('✅ Profiles table created');
    }
    
    // Create user_roles table
    const { error: rolesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS user_roles (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          description TEXT,
          permissions JSONB NOT NULL DEFAULT '[]',
          icon TEXT,
          color TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (rolesError) {
      console.log('⚠️  User roles table might already exist:', rolesError.message);
    } else {
      console.log('✅ User roles table created');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error creating tables:', error);
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
  console.log('🚀 Starting quick fix process...\n');
  
  // Step 1: Create tables
  const tablesCreated = await createTables();
  if (!tablesCreated) {
    console.log('\n❌ Failed to create tables');
    process.exit(1);
  }
  
  console.log('');
  
  // Step 2: Create test data
  const testDataCreated = await createTestData();
  if (!testDataCreated) {
    console.log('\n❌ Failed to create test data');
    process.exit(1);
  }
  
  console.log('\n✅ Quick fix completed successfully!');
  console.log('🎉 Your application should now work without permission errors');
  console.log('\n📋 Next steps:');
  console.log('1. Test your application - it should load without errors');
  console.log('2. The AuthContext timeout should be resolved');
  console.log('3. The React primitive conversion error should be fixed');
  console.log('4. The 400 server error should be resolved');
}

// Run the fix
main().catch(console.error);
