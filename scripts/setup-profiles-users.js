#!/usr/bin/env node

/**
 * Setup Users in Profiles Table
 * This script creates users directly in the profiles table for the custom auth system
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
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

// Sample users to create in profiles table
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
    console.log(`\n🔄 Creating user in profiles table: ${userData.email}`);
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    // Create user in profiles table
    const { data: newUser, error } = await supabase
      .from('profiles')
      .insert([{
        email: userData.email.toLowerCase().trim(),
        password_hash: hashedPassword,
        first_name: userData.first_name.trim(),
        last_name: userData.last_name.trim(),
        role: userData.role,
        phone: userData.phone?.trim() || null,
        is_active: true
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        console.log(`⚠️  User ${userData.email} already exists in profiles table`);
        return { success: true, message: 'User already exists' };
      }
      throw error;
    }

    if (newUser) {
      console.log(`✅ User ${userData.email} created successfully in profiles table`);
      console.log(`   User ID: ${newUser.id}`);
      console.log(`   Role: ${userData.role}`);
      return { success: true, user: newUser };
    }

  } catch (error) {
    console.error(`❌ Error creating user ${userData.email}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function setupProfilesUsers() {
  console.log('🐟 Rio Fish Farm - Profiles Table User Setup');
  console.log('=============================================');
  console.log('This script will create users in the profiles table for custom authentication.\n');

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
  console.log('4. The system will use the profiles table for authentication');
}

// Run the setup
setupProfilesUsers().catch(console.error);
