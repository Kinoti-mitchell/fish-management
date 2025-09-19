#!/usr/bin/env node

/**
 * Fish Management System - First Admin Setup
 * This script helps you create the first admin user without hardcoded credentials
 * 
 * Usage: node scripts/setup-first-admin.js
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const readline = require('readline');

require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  console.log('Please ensure your .env file contains:');
  console.log('VITE_SUPABASE_URL=your_supabase_url');
  console.log('VITE_SUPABASE_ANON_KEY=your_supabase_anon_key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask questions
const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
};

// Helper function to ask for password (hidden input)
const askPassword = (question) => {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    let password = '';
    process.stdin.on('data', function(char) {
      char = char + '';
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl-D
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003': // Ctrl-C
          process.exit();
          break;
        case '\u007f': // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    });
  });
};

// Hash password using bcrypt
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Check if any admin users exist
const checkExistingAdmins = async () => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, first_name, last_name')
      .eq('role', 'admin')
      .eq('is_active', true);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error checking existing admins:', error.message);
    return [];
  }
};

// Check if profiles table exists
const checkProfilesTable = async () => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST116') {
        return false; // Table doesn't exist
      }
      throw error;
    }
    return true;
  } catch (error) {
    console.error('❌ Error checking profiles table:', error.message);
    return false;
  }
};

// Create admin user
const createAdminUser = async (userData) => {
  try {
    const hashedPassword = await hashPassword(userData.password);

    const { data, error } = await supabase
      .from('profiles')
      .insert([{
        email: userData.email,
        first_name: userData.firstName,
        last_name: userData.lastName,
        role: 'admin',
        phone: userData.phone || null,
        is_active: true,
        password_hash: hashedPassword,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    throw error;
  }
};

// Main setup function
const setupFirstAdmin = async () => {
  console.log('🐟 Fish Management System - First Admin Setup\n');
  console.log('This script will help you create the first admin user for your system.\n');

  try {
    // Check if profiles table exists
    console.log('🔍 Checking database setup...');
    const tableExists = await checkProfilesTable();
    
    if (!tableExists) {
      console.log('❌ Profiles table not found!');
      console.log('\n🔧 Please run the database setup first:');
      console.log('1. Go to your Supabase SQL Editor');
      console.log('2. Run: db/create_unified_profiles_table.sql');
      console.log('3. Then run this script again');
      rl.close();
      return;
    }
    
    console.log('✅ Profiles table found');

    // Check if admin users already exist
    const existingAdmins = await checkExistingAdmins();
    
    if (existingAdmins.length > 0) {
      console.log('\n⚠️  Admin users already exist:');
      existingAdmins.forEach(admin => {
        console.log(`   - ${admin.first_name} ${admin.last_name} (${admin.email})`);
      });
      console.log('\nYou can use the User Management interface in the app to create additional users.');
      console.log('Or run this script again to create another admin user.\n');
      
      const continueSetup = await askQuestion('Do you want to create another admin user? (y/N): ');
      if (continueSetup.toLowerCase() !== 'y' && continueSetup.toLowerCase() !== 'yes') {
        console.log('Setup cancelled.');
        rl.close();
        return;
      }
    }

    // Collect user information
    console.log('\n📝 Please provide the following information:\n');

    const email = await askQuestion('Email address: ');
    if (!email || !email.includes('@')) {
      console.log('❌ Please provide a valid email address');
      rl.close();
      return;
    }

    const firstName = await askQuestion('First name: ');
    if (!firstName) {
      console.log('❌ First name is required');
      rl.close();
      return;
    }

    const lastName = await askQuestion('Last name: ');
    if (!lastName) {
      console.log('❌ Last name is required');
      rl.close();
      return;
    }

    const phone = await askQuestion('Phone number (optional): ');

    const password = await askPassword('Password (min 6 characters): ');
    if (!password || password.length < 6) {
      console.log('❌ Password must be at least 6 characters long');
      rl.close();
      return;
    }

    const confirmPassword = await askPassword('Confirm password: ');
    if (password !== confirmPassword) {
      console.log('❌ Passwords do not match');
      rl.close();
      return;
    }

    console.log('\n🔄 Creating admin user...');

    // Create the admin user
    const newAdmin = await createAdminUser({
      email,
      firstName,
      lastName,
      phone,
      password
    });

    console.log('✅ Admin user created successfully!\n');
    console.log('📋 Login Credentials:');
    console.log(`   Email: ${newAdmin.email}`);
    console.log(`   Password: [the password you entered]`);
    console.log(`   Role: ${newAdmin.role}`);
    console.log(`   Status: ${newAdmin.is_active ? 'Active' : 'Inactive'}\n`);

    console.log('🎉 Setup complete! You can now:');
    console.log('1. Go to your application: http://localhost:3003');
    console.log('2. Login with the credentials above');
    console.log('3. Use the User Management section to create additional users');
    console.log('4. All users will be created through the application interface (no hardcoded credentials)');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure your Supabase database is running');
    console.log('2. Check that the profiles table exists (run db/create_unified_profiles_table.sql)');
    console.log('3. Verify your environment variables are correct');
    console.log('4. Check your internet connection');
  } finally {
    rl.close();
  }
};

// Run the setup
setupFirstAdmin().catch(console.error);