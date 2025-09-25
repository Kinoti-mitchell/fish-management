#!/usr/bin/env node

/**
 * Update All User Passwords to "password123"
 * This script updates all existing users in the database to use "password123" as their password
 * with proper bcrypt hashing.
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

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

// Hash password using bcrypt
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Get all users from the database
const getAllUsers = async () => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, is_active')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching users:', error.message);
    throw error;
  }
};

// Update user password
const updateUserPassword = async (userId, hashedPassword) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        password_hash: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('❌ Error updating password for user:', userId, error.message);
    throw error;
  }
};

// Main function
const updateAllPasswords = async () => {
  console.log('🔐 Fish Management System - Update All Passwords\n');
  console.log('This script will update ALL user passwords to "password123"\n');

  try {
    // Get all users
    console.log('📋 Fetching all users...');
    const users = await getAllUsers();
    
    if (users.length === 0) {
      console.log('ℹ️  No users found in the database.');
      console.log('You may need to create users first using the setup script or User Management interface.');
      return;
    }

    console.log(`✅ Found ${users.length} user(s):`);
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.first_name} ${user.last_name} (${user.email}) - Role: ${user.role} - Status: ${user.is_active ? 'Active' : 'Inactive'}`);
    });

    // Hash the new password
    console.log('\n🔒 Hashing new password "password123"...');
    const hashedPassword = await hashPassword('password123');
    console.log('✅ Password hashed successfully');

    // Update all users
    console.log('\n🔄 Updating passwords for all users...');
    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        await updateUserPassword(user.id, hashedPassword);
        console.log(`   ✅ Updated: ${user.email}`);
        successCount++;
      } catch (error) {
        console.log(`   ❌ Failed: ${user.email} - ${error.message}`);
        errorCount++;
      }
    }

    // Summary
    console.log('\n📊 Update Summary:');
    console.log(`   ✅ Successfully updated: ${successCount} user(s)`);
    if (errorCount > 0) {
      console.log(`   ❌ Failed to update: ${errorCount} user(s)`);
    }

    if (successCount > 0) {
      console.log('\n🎉 Password update completed!');
      console.log('\n📋 New Login Credentials:');
      console.log('   Password: password123');
      console.log('   (Use the email addresses shown above)');
      console.log('\n🔧 Next steps:');
      console.log('1. Go to your application: http://localhost:3003');
      console.log('2. Login with any user email and password: password123');
      console.log('3. Users can change their passwords through the User Management interface');
    }

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure your Supabase database is running');
    console.log('2. Check that the profiles table exists');
    console.log('3. Verify your environment variables are correct');
    console.log('4. Check your internet connection');
  }
};

// Run the script
updateAllPasswords().catch(console.error);
