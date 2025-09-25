#!/usr/bin/env node

/**
 * Test Authentication Script
 * This script helps diagnose authentication issues
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.log('Please ensure your .env file contains:');
  console.log('VITE_SUPABASE_URL=your_supabase_url');
  console.log('VITE_SUPABASE_ANON_KEY=your_supabase_anon_key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

async function testAuthentication() {
  console.log('🔍 Testing Authentication...\n');
  
  try {
    // Test 1: Check current session
    console.log('1. Checking current session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.log('❌ Session check failed:', sessionError.message);
    } else if (session) {
      console.log('✅ Session found:', session.user?.email);
    } else {
      console.log('⚠️  No active session found');
    }
    
    // Test 2: Check current user
    console.log('\n2. Checking current user...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.log('❌ User check failed:', userError.message);
    } else if (user) {
      console.log('✅ User found:', user.email);
    } else {
      console.log('⚠️  No user found');
    }
    
    // Test 3: Test database access
    console.log('\n3. Testing database access...');
    const { data, error } = await supabase
      .from('sorting_batches')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('❌ Database access failed:', error.message);
      
      if (error.message.includes('406')) {
        console.log('💡 This is a 406 error - likely RLS policy issue');
      } else if (error.message.includes('401')) {
        console.log('💡 This is a 401 error - authentication required');
      } else if (error.message.includes('403')) {
        console.log('💡 This is a 403 error - permission denied');
      }
    } else {
      console.log('✅ Database access successful');
    }
    
    // Test 4: Check if user needs to log in
    console.log('\n4. Authentication Status:');
    if (!session && !user) {
      console.log('❌ User is not authenticated');
      console.log('💡 Solution: User needs to log in through the web interface');
    } else if (session && user) {
      console.log('✅ User is properly authenticated');
    } else {
      console.log('⚠️  Partial authentication - session or user missing');
    }
    
  } catch (error) {
    console.error('❌ Authentication test failed:', error.message);
  }
}

async function provideSolutions() {
  console.log('\n💡 Solutions for Authentication Issues:\n');
  
  console.log('1. **User Not Logged In** (Most Common):');
  console.log('   - Go to your web application');
  console.log('   - Navigate to the login page');
  console.log('   - Log in with your credentials');
  console.log('   - Try the sort fish button again');
  console.log('');
  
  console.log('2. **Session Expired**:');
  console.log('   - Refresh the browser page');
  console.log('   - Log in again if prompted');
  console.log('   - Check if "Remember me" is enabled');
  console.log('');
  
  console.log('3. **RLS Policy Issues** (406 errors):');
  console.log('   - Go to Supabase dashboard');
  console.log('   - Navigate to Authentication > Policies');
  console.log('   - Update sorting_batches table policies');
  console.log('   - See SUPABASE_RLS_FIX.md for details');
  console.log('');
  
  console.log('4. **API Key Issues**:');
  console.log('   - Verify VITE_SUPABASE_URL is correct');
  console.log('   - Verify VITE_SUPABASE_ANON_KEY is correct');
  console.log('   - Make sure you\'re using the anon key, not service role key');
  console.log('');
  
  console.log('🚀 **Quick Fix Steps**:');
  console.log('1. Open your web application in a browser');
  console.log('2. Go to the login page');
  console.log('3. Log in with your credentials');
  console.log('4. Navigate to the sorting management page');
  console.log('5. Try clicking the "Sort Fish" button');
  console.log('6. If you still get errors, check the browser console');
}

async function main() {
  console.log('🐟 Rio Fish Farm - Authentication Test');
  console.log('=======================================\n');
  
  await testAuthentication();
  await provideSolutions();
  
  console.log('\n📊 Summary:');
  console.log('- If you see "User is not authenticated", you need to log in through the web interface');
  console.log('- If you see "Database access failed", check RLS policies');
  console.log('- If you see "Session found" and "User found", authentication is working');
  console.log('\n🌐 Next: Open your web application and log in to test the sort fish button');
}

// Run the test
main().catch(console.error);
