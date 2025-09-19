#!/usr/bin/env node

/**
 * Check Database Users
 * This script checks what users exist in the database without creating any
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseUsers() {
  console.log('🔍 Checking Database Users');
  console.log('==========================');
  console.log('Checking what users exist in your database...\n');

  try {
    // Check profiles table
    console.log('📋 Checking profiles table...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, is_active, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('❌ Error accessing profiles table:', profilesError.message);
    } else {
      console.log(`✅ Found ${profiles.length} users in profiles table:`);
      if (profiles.length === 0) {
        console.log('   No users found in profiles table');
      } else {
        profiles.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.first_name} ${user.last_name} (${user.email})`);
          console.log(`      Role: ${user.role} | Active: ${user.is_active} | Created: ${new Date(user.created_at).toLocaleDateString()}`);
        });
      }
    }

    console.log('\n📋 Checking Supabase Auth users...');
    // Note: We can't directly query Supabase Auth users with anon key
    // This would require service role key
    console.log('   (Supabase Auth users require service role key to query)');

    console.log('\n📊 Database Summary:');
    console.log('====================');
    console.log(`Profiles table users: ${profiles ? profiles.length : 'Error accessing'}`);
    console.log('Supabase Auth users: Cannot check with current permissions');

    if (profiles && profiles.length > 0) {
      console.log('\n🔑 Available Login Credentials:');
      console.log('===============================');
      console.log('You can log in with any of the users above.');
      console.log('Note: You will need to know their passwords to log in.');
      console.log('If you don\'t know the passwords, you can reset them or create new users through the admin interface.');
    } else {
      console.log('\n⚠️  No users found in profiles table.');
      console.log('You will need to create users through the admin interface or setup script.');
    }

  } catch (error) {
    console.error('❌ Error checking database:', error.message);
  }
}

// Run the check
checkDatabaseUsers().catch(console.error);
