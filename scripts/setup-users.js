#!/usr/bin/env node

/**
 * User Setup Script for Rio Fish Farm
 * This script helps you create users in Supabase with proper roles
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.log('Please ensure your .env file contains:');
  console.log('VITE_SUPABASE_URL=your_supabase_url');
  console.log('VITE_SUPABASE_ANON_KEY=your_supabase_anon_key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Sample users to create
const sampleUsers = [
  {
    email: 'admin@riofish.com',
    password: 'admin123!',
    first_name: 'Admin',
    last_name: 'User',
    role: 'admin',
    phone: '+254700000000'
  },
  {
    email: 'manager@riofish.com',
    password: 'manager123!',
    first_name: 'Manager',
    last_name: 'User',
    role: 'manager',
    phone: '+254700000001'
  },
  {
    email: 'staff@riofish.com',
    password: 'staff123!',
    first_name: 'Staff',
    last_name: 'User',
    role: 'staff',
    phone: '+254700000002'
  },
  {
    email: 'viewer@riofish.com',
    password: 'viewer123!',
    first_name: 'Viewer',
    last_name: 'User',
    role: 'viewer',
    phone: '+254700000003'
  }
];

async function createUser(userData) {
  try {
    console.log(`\n🔄 Creating user: ${userData.email}`);
    
    // Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          first_name: userData.first_name,
          last_name: userData.last_name,
          role: userData.role
        }
      }
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log(`⚠️  User ${userData.email} already exists`);
        return { success: true, message: 'User already exists' };
      }
      throw authError;
    }

    if (authData.user) {
      console.log(`✅ User ${userData.email} created successfully`);
      console.log(`   User ID: ${authData.user.id}`);
      console.log(`   Role: ${userData.role}`);
      return { success: true, user: authData.user };
    }

  } catch (error) {
    console.error(`❌ Error creating user ${userData.email}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function setupUsers() {
  console.log('🐟 Rio Fish Farm - User Setup');
  console.log('================================');
  console.log('This script will create sample users in your Supabase project.');
  console.log('Make sure you have run the database migrations first.\n');

  const results = [];
  
  for (const user of sampleUsers) {
    const result = await createUser(user);
    results.push({ email: user.email, ...result });
  }

  console.log('\n📊 Setup Summary:');
  console.log('==================');
  
  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.email} - ${result.message || 'Created successfully'}`);
    } else {
      console.log(`❌ ${result.email} - ${result.error}`);
    }
  });

  console.log('\n🔑 Login Credentials:');
  console.log('=====================');
  sampleUsers.forEach(user => {
    console.log(`Email: ${user.email} | Password: ${user.password} | Role: ${user.role}`);
  });

  console.log('\n🚀 Next Steps:');
  console.log('1. Run: npm run dev');
  console.log('2. Go to http://localhost:3000');
  console.log('3. Use any of the credentials above to login');
  console.log('4. The system will automatically create user profiles');
}

// Run the setup
setupUsers().catch(console.error);
