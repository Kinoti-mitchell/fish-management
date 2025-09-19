#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/server.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUserDetails() {
  console.log('🔍 Checking user details...\n');
  
  try {
    // Check all profiles
    console.log('📋 All profiles in database:');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('email');
    
    if (profilesError) {
      console.log('❌ Error fetching profiles:', profilesError.message);
      return;
    }
    
    profiles.forEach(profile => {
      console.log(`   - ${profile.email} (${profile.role}) - ID: ${profile.id}`);
    });
    
    // Check for Mitchell specifically
    console.log('\n🔍 Looking for Mitchell users:');
    const mitchellProfiles = profiles.filter(p => 
      p.email.toLowerCase().includes('mitchell') || 
      p.email.toLowerCase().includes('kinoti') ||
      p.first_name.toLowerCase().includes('mitchell')
    );
    
    if (mitchellProfiles.length > 0) {
      console.log('✅ Found Mitchell-related profiles:');
      mitchellProfiles.forEach(profile => {
        console.log(`   - Email: ${profile.email}`);
        console.log(`   - Name: ${profile.first_name} ${profile.last_name}`);
        console.log(`   - Role: ${profile.role}`);
        console.log(`   - Active: ${profile.is_active}`);
        console.log(`   - ID: ${profile.id}`);
        console.log('   ---');
      });
    } else {
      console.log('❌ No Mitchell-related profiles found');
    }
    
    // Check if there are any admin users
    console.log('\n👑 Admin users:');
    const adminProfiles = profiles.filter(p => p.role === 'admin');
    if (adminProfiles.length > 0) {
      adminProfiles.forEach(profile => {
        console.log(`   - ${profile.email} (${profile.first_name} ${profile.last_name})`);
      });
    } else {
      console.log('❌ No admin users found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUserDetails();
