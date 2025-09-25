#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAdminLogin() {
  console.log('🔐 Testing admin login...\n');
  
  const testUsers = [
    { email: 'admin@riofish.com', password: 'admin123' },
    { email: 'admin@riofish.com', password: 'password' },
    { email: 'mitchellkinoti@gmail.com', password: 'admin123' },
    { email: 'mitchellkinoti@gmail.com', password: 'password' }
  ];
  
  for (const user of testUsers) {
    console.log(`Testing: ${user.email} with password: ${user.password}`);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });
      
      if (error) {
        console.log(`❌ Failed: ${error.message}`);
      } else {
        console.log(`✅ SUCCESS! Logged in as: ${data.user.email}`);
        console.log(`   User ID: ${data.user.id}`);
        console.log(`   Email Confirmed: ${data.user.email_confirmed_at ? 'Yes' : 'No'}`);
        return;
      }
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }
    console.log('');
  }
  
  console.log('❌ All login attempts failed');
  console.log('\n🔧 Next steps:');
  console.log('1. Go to Supabase Dashboard > Authentication > Users');
  console.log('2. Check if these users exist and have passwords set');
  console.log('3. If not, create them or reset their passwords');
}

testAdminLogin();
