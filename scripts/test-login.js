#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

// Use anon key for client-side authentication
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
  console.log('🔐 Testing login with admin@rio.com...\n');
  
  try {
    // Test login
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'admin@rio.com',
      password: 'admin123' // You'll need to provide the actual password
    });
    
    if (error) {
      console.error('❌ Login failed:', error.message);
      console.log('\n💡 Possible issues:');
      console.log('1. Wrong password');
      console.log('2. User not confirmed');
      console.log('3. User doesn\'t exist');
      console.log('\n🔧 Solutions:');
      console.log('1. Check the password in Supabase dashboard');
      console.log('2. Make sure user is confirmed');
      console.log('3. Try creating a new user');
    } else {
      console.log('✅ Login successful!');
      console.log('User ID:', data.user.id);
      console.log('Email:', data.user.email);
      
      // Test profile fetch
      console.log('\n📋 Testing profile fetch...');
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      
      if (profileError) {
        console.error('❌ Profile fetch failed:', profileError.message);
        console.log('This is expected if the profile doesn\'t exist yet.');
      } else {
        console.log('✅ Profile found:');
        console.log('Name:', profile.first_name, profile.last_name);
        console.log('Role:', profile.role);
        console.log('Active:', profile.is_active);
      }
    }
  } catch (error) {
    console.error('❌ Login test failed:', error.message);
  }
}

testLogin();
