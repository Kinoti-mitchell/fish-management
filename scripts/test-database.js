#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDatabase() {
  console.log('🔍 Testing database connection and tables...\n');
  
  try {
    // Test profiles table
    console.log('📋 Testing profiles table...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (profilesError) {
      console.error('❌ Profiles table error:', profilesError.message);
    } else {
      console.log('✅ Profiles table accessible');
    }
    
    // Test user_roles table
    console.log('👥 Testing user_roles table...');
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*')
      .limit(1);
    
    if (rolesError) {
      console.error('❌ User roles table error:', rolesError.message);
    } else {
      console.log('✅ User roles table accessible');
      if (roles && roles.length > 0) {
        console.log(`   Found ${roles.length} role(s)`);
      }
    }
    
    // Test farmers table
    console.log('🐟 Testing farmers table...');
    const { data: farmers, error: farmersError } = await supabase
      .from('farmers')
      .select('*')
      .limit(1);
    
    if (farmersError) {
      console.error('❌ Farmers table error:', farmersError.message);
    } else {
      console.log('✅ Farmers table accessible');
    }
    
    // Test warehouse_entries table
    console.log('📦 Testing warehouse_entries table...');
    const { data: entries, error: entriesError } = await supabase
      .from('warehouse_entries')
      .select('*')
      .limit(1);
    
    if (entriesError) {
      console.error('❌ Warehouse entries table error:', entriesError.message);
    } else {
      console.log('✅ Warehouse entries table accessible');
    }
    
    console.log('\n🎉 Database test completed!');
    
    // Check if we need to create default roles
    if (roles && roles.length === 0) {
      console.log('\n📝 No roles found. Creating default roles...');
      await createDefaultRoles();
    }
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  }
}

async function createDefaultRoles() {
  const defaultRoles = [
    {
      name: 'admin',
      display_name: 'Administrator',
      description: 'Full system access and control. Can manage all users, roles, and system settings.',
      permissions: JSON.stringify(['*']),
      icon: 'Crown',
      color: 'bg-red-100 text-red-800 border-red-200',
      is_active: true
    },
    {
      name: 'processor',
      display_name: 'Fish Processor',
      description: 'Manages fish processing operations, quality control, and production workflows.',
      permissions: JSON.stringify(['read:all', 'write:processing', 'write:quality', 'read:inventory']),
      icon: 'Package',
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      is_active: true
    },
    {
      name: 'viewer',
      display_name: 'Viewer',
      description: 'Read-only access to system data. Cannot modify any information.',
      permissions: JSON.stringify(['read:basic']),
      icon: 'Eye',
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      is_active: true
    }
  ];
  
  const { error } = await supabase
    .from('user_roles')
    .insert(defaultRoles);
  
  if (error) {
    console.error('❌ Error creating default roles:', error.message);
  } else {
    console.log('✅ Default roles created successfully');
  }
}

testDatabase();
