#!/usr/bin/env node

/**
 * Database Fix Script
 * This script helps fix common database issues that cause 400 errors
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

async function checkDatabaseHealth() {
  console.log('🔍 Checking database health...');
  
  try {
    // Check if profiles table exists and has data
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, is_active')
      .limit(5);
    
    if (profilesError) {
      console.error('❌ Profiles table error:', profilesError);
      return false;
    }
    
    console.log('✅ Profiles table accessible');
    console.log(`📊 Found ${profiles?.length || 0} profiles`);
    
    // Check if user_roles table exists
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('name, display_name, is_active')
      .limit(5);
    
    if (rolesError) {
      console.error('❌ User roles table error:', rolesError);
      return false;
    }
    
    console.log('✅ User roles table accessible');
    console.log(`📊 Found ${roles?.length || 0} roles`);
    
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return false;
  }
}

async function createDefaultAdmin() {
  console.log('👤 Creating default admin user...');
  
  try {
    // Check if admin profile exists
    const { data: existingAdmin, error: checkError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('role', 'admin')
      .eq('is_active', true)
      .limit(1);
    
    if (checkError) {
      console.error('❌ Error checking for existing admin:', checkError);
      return false;
    }
    
    if (existingAdmin && existingAdmin.length > 0) {
      console.log('✅ Admin user already exists:', existingAdmin[0].email);
      return true;
    }
    
    // Create a temporary admin profile for testing
    const tempAdminId = '1a31181e-9b3d-4928-8349-f5b38466e5fb';
    
    const { data: newAdmin, error: insertError } = await supabase
      .from('profiles')
      .upsert([{
        id: tempAdminId,
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
    
    if (insertError) {
      console.error('❌ Error creating admin profile:', insertError);
      return false;
    }
    
    console.log('✅ Default admin user created successfully');
    return true;
  } catch (error) {
    console.error('❌ Error creating default admin:', error);
    return false;
  }
}

async function createDefaultRoles() {
  console.log('🔐 Creating default user roles...');
  
  try {
    const defaultRoles = [
      {
        name: 'admin',
        display_name: 'Administrator',
        description: 'Full system access and control',
        permissions: ['*'],
        icon: 'Crown',
        color: 'bg-red-100 text-red-800 border-red-200',
        is_active: true
      },
      {
        name: 'processor',
        display_name: 'Fish Processor',
        description: 'Manages fish processing operations',
        permissions: ['read:inventory', 'write:processing', 'read:orders', 'write:dispatch'],
        icon: 'Package',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        is_active: true
      },
      {
        name: 'warehouse_manager',
        display_name: 'Warehouse Manager',
        description: 'Oversees warehouse operations',
        permissions: ['read:inventory', 'write:inventory', 'read:logistics', 'write:logistics'],
        icon: 'Package',
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        is_active: true
      },
      {
        name: 'outlet_manager',
        display_name: 'Outlet Manager',
        description: 'Manages retail outlets and sales',
        permissions: ['read:sales', 'write:sales', 'read:customers', 'write:customers', 'read:inventory'],
        icon: 'Building',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        is_active: true
      },
      {
        name: 'viewer',
        display_name: 'Viewer',
        description: 'Read-only access to system data',
        permissions: ['read:basic'],
        icon: 'Eye',
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        is_active: true
      }
    ];
    
    const { data: roles, error: insertError } = await supabase
      .from('user_roles')
      .upsert(defaultRoles, { onConflict: 'name' })
      .select();
    
    if (insertError) {
      console.error('❌ Error creating default roles:', insertError);
      return false;
    }
    
    console.log('✅ Default user roles created successfully');
    return true;
  } catch (error) {
    console.error('❌ Error creating default roles:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting database fix process...\n');
  
  // Step 1: Check database health
  const isHealthy = await checkDatabaseHealth();
  if (!isHealthy) {
    console.log('\n❌ Database health check failed. Please run the SQL setup scripts first.');
    console.log('📝 Run the SQL commands from db/simple_fix.sql in your Supabase SQL Editor');
    process.exit(1);
  }
  
  // Step 2: Create default roles
  const rolesCreated = await createDefaultRoles();
  if (!rolesCreated) {
    console.log('\n❌ Failed to create default roles');
    process.exit(1);
  }
  
  // Step 3: Create default admin
  const adminCreated = await createDefaultAdmin();
  if (!adminCreated) {
    console.log('\n❌ Failed to create default admin');
    process.exit(1);
  }
  
  console.log('\n✅ Database fix completed successfully!');
  console.log('🎉 Your application should now work without 400 errors');
  console.log('\n📋 Next steps:');
  console.log('1. Try logging in with the default admin credentials');
  console.log('2. Check the browser console for any remaining errors');
  console.log('3. If issues persist, check the Supabase dashboard for any RLS policy issues');
}

// Run the fix
main().catch(console.error);
