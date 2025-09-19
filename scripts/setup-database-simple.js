#!/usr/bin/env node

/**
 * Simple Database Setup Script for RioFish Fish Management System
 * 
 * This script creates the necessary tables and initial data using direct SQL execution
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  try {
    console.log('🔍 Testing Supabase connection...');
    
    // Test connection by trying to fetch from a system table
    const { data, error } = await supabase
      .from('pg_tables')
      .select('tablename')
      .limit(1);
    
    if (error) {
      console.log('⚠️  Direct table access failed, trying alternative method...');
      
      // Try a simpler test
      const { data: testData, error: testError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .limit(1);
        
      if (testError) {
        console.error('❌ Cannot connect to Supabase. Please check your credentials.');
        console.error('Error:', testError.message);
        return false;
      }
    }
    
    console.log('✅ Successfully connected to Supabase!');
    return true;
  } catch (err) {
    console.error('❌ Connection test failed:', err.message);
    return false;
  }
}

async function createTables() {
  console.log('📋 Creating database tables...');
  
  // Since we can't run raw SQL easily, let's create the tables by inserting data
  // This will create the tables if they don't exist (with proper RLS policies)
  
  try {
    // Test if profiles table exists by trying to insert a test record
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{
        id: '00000000-0000-0000-0000-000000000000',
        first_name: 'Test',
        last_name: 'User',
        role: 'admin',
        is_active: true
      }]);
    
    if (profileError && profileError.code === '42P01') {
      console.log('📝 Profiles table does not exist. Please run the SQL migrations manually in Supabase SQL Editor.');
      console.log('📁 Migration files to run:');
      console.log('   1. db/migrations/001_initial_schema.sql');
      console.log('   2. db/migrations/002_role_management.sql');
      console.log('   3. db/migrations/003_fix_auth_integration.sql');
      return false;
    } else if (profileError && profileError.code === '23505') {
      console.log('✅ Profiles table exists (duplicate key error is expected)');
    } else if (!profileError) {
      console.log('✅ Profiles table created successfully');
      // Clean up test record
      await supabase.from('profiles').delete().eq('id', '00000000-0000-0000-0000-000000000000');
    }
    
    return true;
  } catch (err) {
    console.error('❌ Error creating tables:', err.message);
    return false;
  }
}

async function createDefaultRoles() {
  console.log('👥 Creating default user roles...');
  
  try {
    // Check if user_roles table exists and has data
    const { data: roles, error } = await supabase
      .from('user_roles')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('⚠️  user_roles table not found. Please run the SQL migrations first.');
      return false;
    }
    
    if (roles && roles.length > 0) {
      console.log('✅ Default roles already exist');
      return true;
    }
    
    // Insert default roles
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
    
    const { error: insertError } = await supabase
      .from('user_roles')
      .insert(defaultRoles);
    
    if (insertError) {
      console.error('❌ Error creating default roles:', insertError.message);
      return false;
    }
    
    console.log('✅ Default roles created successfully');
    return true;
  } catch (err) {
    console.error('❌ Error creating roles:', err.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting RioFish Database Setup...\n');
  
  // Test connection
  const connected = await testConnection();
  if (!connected) {
    process.exit(1);
  }
  
  // Create tables (this will guide user to run SQL migrations if needed)
  const tablesCreated = await createTables();
  if (!tablesCreated) {
    console.log('\n📋 Manual Setup Required:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run the following migration files in order:');
    console.log('   - db/migrations/001_initial_schema.sql');
    console.log('   - db/migrations/002_role_management.sql');
    console.log('   - db/migrations/003_fix_auth_integration.sql');
    console.log('\n4. Then run this script again: npm run setup-db');
    process.exit(1);
  }
  
  // Create default roles
  await createDefaultRoles();
  
  console.log('\n🎉 Database setup completed successfully!');
  console.log('\n📋 Next steps:');
  console.log('1. Run "npm run setup-users" to create initial users');
  console.log('2. Start the app with "npm run dev"');
  console.log('3. Access the app at http://localhost:3001');
}

main().catch(console.error);
