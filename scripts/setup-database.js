#!/usr/bin/env node

/**
 * Database Setup Script for RioFish Fish Management System
 * 
 * This script helps initialize the database with the necessary tables,
 * roles, and initial data for the role-based management system.
 * 
 * Usage: node setup-database.js
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

async function runMigration(filePath) {
  try {
    console.log(`📄 Running migration: ${path.basename(filePath)}`);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.error(`❌ Migration failed: ${error.message}`);
      return false;
    }
    
    console.log(`✅ Migration completed: ${path.basename(filePath)}`);
    return true;
  } catch (err) {
    console.error(`❌ Error running migration: ${err.message}`);
    return false;
  }
}

async function createDefaultAdmin() {
  try {
    console.log('👤 Creating default admin user...');
    
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'admin@riofish.com',
      password: 'admin123',
      email_confirm: true,
      user_metadata: {
        first_name: 'System',
        last_name: 'Administrator',
        role: 'admin'
      }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        console.log('ℹ️  Admin user already exists');
        return true;
      }
      throw error;
    }

    console.log('✅ Default admin user created');
    console.log('   Email: admin@riofish.com');
    console.log('   Password: admin123');
    console.log('   ⚠️  Please change the password immediately!');
    return true;
  } catch (err) {
    console.error(`❌ Error creating admin user: ${err.message}`);
    return false;
  }
}

async function verifySetup() {
  try {
    console.log('🔍 Verifying setup...');
    
    // Check if tables exist
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['user_roles', 'profiles', 'user_sessions', 'audit_logs']);

    if (tablesError) {
      console.error(`❌ Error checking tables: ${tablesError.message}`);
      return false;
    }

    const expectedTables = ['user_roles', 'profiles', 'user_sessions', 'audit_logs'];
    const existingTables = tables.map(t => t.table_name);
    const missingTables = expectedTables.filter(t => !existingTables.includes(t));

    if (missingTables.length > 0) {
      console.error(`❌ Missing tables: ${missingTables.join(', ')}`);
      return false;
    }

    // Check if roles exist
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('name');

    if (rolesError) {
      console.error(`❌ Error checking roles: ${rolesError.message}`);
      return false;
    }

    const expectedRoles = ['admin', 'processor', 'farmer', 'outlet_manager', 'warehouse_manager', 'viewer'];
    const existingRoles = roles.map(r => r.name);
    const missingRoles = expectedRoles.filter(r => !existingRoles.includes(r));

    if (missingRoles.length > 0) {
      console.error(`❌ Missing roles: ${missingRoles.join(', ')}`);
      return false;
    }

    console.log('✅ Database setup verified successfully');
    return true;
  } catch (err) {
    console.error(`❌ Error verifying setup: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting RioFish Database Setup...\n');

  // Check if we can connect to Supabase
  try {
    const { data, error } = await supabase.from('user_roles').select('count').limit(1);
    if (error) {
      console.error('❌ Cannot connect to Supabase. Please check your credentials.');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }

  // Run migrations
  const migrations = [
    path.join(process.cwd(), 'db', 'migrations', '001_initial_schema.sql'),
    path.join(process.cwd(), 'db', 'migrations', '002_role_management.sql')
  ];

  for (const migration of migrations) {
    if (!fs.existsSync(migration)) {
      console.error(`❌ Migration file not found: ${migration}`);
      process.exit(1);
    }

    const success = await runMigration(migration);
    if (!success) {
      console.error('❌ Migration failed. Please check the error messages above.');
      process.exit(1);
    }
  }

  // Create default admin user
  await createDefaultAdmin();

  // Verify setup
  const verified = await verifySetup();
  if (!verified) {
    console.error('❌ Setup verification failed. Please check the error messages above.');
    process.exit(1);
  }

  console.log('\n🎉 Database setup completed successfully!');
  console.log('\n📋 Next steps:');
  console.log('1. Start the development server: npm run dev');
  console.log('2. Login with admin@riofish.com / admin123');
  console.log('3. Change the admin password immediately');
  console.log('4. Create additional users through the User Management interface');
  console.log('5. Configure email settings for user notifications');
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the setup
main().catch(err => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});
