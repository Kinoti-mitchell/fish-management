#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixAdminLogin() {
  console.log('🔧 Fixing admin login...\n');
  
  try {
    // Create profiles table if it doesn't exist
    console.log('📝 Creating profiles table...');
    const { error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (profilesError && profilesError.code === 'PGRST116') {
      console.log('Creating profiles table...');
      // Table doesn't exist, we need to create it via SQL
      console.log('⚠️  Profiles table does not exist. Please run the SQL fix in Supabase SQL Editor.');
      console.log('Copy the contents of db/quick_fix_v2.sql and run it in Supabase SQL Editor.');
      return;
    }
    
    // Create user_roles table if it doesn't exist
    console.log('📝 Checking user_roles table...');
    const { error: rolesError } = await supabase
      .from('user_roles')
      .select('id')
      .limit(1);
    
    if (rolesError && rolesError.code === 'PGRST116') {
      console.log('⚠️  User roles table does not exist. Please run the SQL fix in Supabase SQL Editor.');
      return;
    }
    
    // Insert basic roles
    console.log('👥 Creating default roles...');
    const roles = [
      {
        name: 'admin',
        display_name: 'Administrator',
        description: 'Full system access',
        permissions: ['*'],
        icon: 'Crown',
        color: 'bg-red-100 text-red-800 border-red-200',
        is_active: true
      },
      {
        name: 'processor',
        display_name: 'Fish Processor',
        description: 'Processing operations',
        permissions: ['read:all', 'write:processing'],
        icon: 'Package',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        is_active: true
      },
      {
        name: 'viewer',
        display_name: 'Viewer',
        description: 'Read-only access',
        permissions: ['read:basic'],
        icon: 'Eye',
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        is_active: true
      }
    ];
    
    for (const role of roles) {
      const { error } = await supabase
        .from('user_roles')
        .upsert(role, { onConflict: 'name' });
      
      if (error) {
        console.log(`⚠️  Role ${role.name} error: ${error.message}`);
      } else {
        console.log(`✅ Role ${role.name} created/updated`);
      }
    }
    
    // Create admin profile
    console.log('👤 Creating admin profile...');
    const adminProfile = {
      id: '1a31181e-9b3d-4928-8349-f5b38466e5fb',
      first_name: 'Mitchell',
      last_name: 'Kinoti',
      role: 'admin',
      is_active: true,
      email: 'mitchellkinoti@gmail.com'
    };
    
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(adminProfile, { onConflict: 'id' });
    
    if (profileError) {
      console.log(`❌ Profile error: ${profileError.message}`);
    } else {
      console.log('✅ Admin profile created/updated');
    }
    
    console.log('\n🎉 Admin login fix completed!');
    console.log('You can now log in with:');
    console.log('- Email: mitchellkinoti@gmail.com');
    console.log('- Role: admin');
    
  } catch (error) {
    console.error('❌ Error fixing admin login:', error.message);
    console.log('\n📋 Manual fix required:');
    console.log('1. Go to Supabase SQL Editor');
    console.log('2. Copy and run the contents of db/quick_fix_v2.sql');
    console.log('3. This will create the necessary tables and admin profile');
  }
}

fixAdminLogin();
