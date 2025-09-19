#!/usr/bin/env node

/**
 * Update All User Passwords
 * This script updates all existing users' passwords to a new password
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateAllPasswords() {
  console.log('🔐 Updating All User Passwords');
  console.log('==============================');
  console.log('Setting all user passwords to: 1234567890\n');

  try {
    // Get all users from profiles table
    console.log('📋 Fetching all users...');
    const { data: users, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role')
      .eq('is_active', true);

    if (fetchError) {
      console.error('❌ Error fetching users:', fetchError.message);
      return;
    }

    if (!users || users.length === 0) {
      console.log('⚠️  No active users found in the database');
      return;
    }

    console.log(`✅ Found ${users.length} active users to update\n`);

    // Hash the new password
    const newPassword = '1234567890';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('🔒 Password hashed successfully\n');

    // Update each user's password
    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        console.log(`🔄 Updating password for: ${user.first_name} ${user.last_name} (${user.email})`);
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            password_hash: hashedPassword,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateError) {
          console.error(`   ❌ Error updating ${user.email}:`, updateError.message);
          errorCount++;
        } else {
          console.log(`   ✅ Password updated successfully`);
          successCount++;
        }
      } catch (error) {
        console.error(`   ❌ Error updating ${user.email}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Update Summary:');
    console.log('==================');
    console.log(`✅ Successfully updated: ${successCount} users`);
    console.log(`❌ Failed to update: ${errorCount} users`);
    console.log(`📝 Total users processed: ${users.length}`);

    if (successCount > 0) {
      console.log('\n🔑 Updated Login Credentials:');
      console.log('=============================');
      console.log('All users now have the password: 1234567890');
      console.log('\nYou can now log in with any of these accounts:');
      
      users.forEach((user, index) => {
        if (index < 10) { // Show first 10 users
          console.log(`   ${index + 1}. ${user.first_name} ${user.last_name} (${user.email}) - Role: ${user.role}`);
        }
      });
      
      if (users.length > 10) {
        console.log(`   ... and ${users.length - 10} more users`);
      }
    }

  } catch (error) {
    console.error('❌ Error updating passwords:', error.message);
  }
}

// Run the update
updateAllPasswords().catch(console.error);
