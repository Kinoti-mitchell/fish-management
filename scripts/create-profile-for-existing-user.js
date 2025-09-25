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

async function createProfileForUser() {
  console.log('👤 Creating profile for existing user...\n');
  
  // Create profile for mitchellkinoti@gmail.com (the user trying to log in)
  const userId = '1a31181e-9b3d-4928-8349-f5b38466e5fb';
  const userEmail = 'mitchellkinoti@gmail.com';
  
  console.log(`📝 Creating profile for ${userEmail} (${userId})...`);
  
  const profileData = {
    id: userId,
    first_name: 'Mitchell',
    last_name: 'Kinoti',
    role: 'admin',
    is_active: true,
    email: userEmail,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert([profileData])
    .select();
  
  if (profileError) {
    console.error('❌ Error creating profile:', profileError.message);
    
    // Try to update if it already exists
    if (profileError.code === '23505') {
      console.log('🔄 Profile already exists, updating...');
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: 'Mitchell',
          last_name: 'Kinoti',
          role: 'admin',
          is_active: true,
          email: userEmail,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select();
        
      if (updateError) {
        console.error('❌ Error updating profile:', updateError.message);
      } else {
        console.log('✅ Profile updated successfully');
      }
    }
  } else {
    console.log('✅ Profile created successfully');
  }
  
  // Also create profile for manager@riofish.com
  console.log('\n📝 Creating profile for manager@riofish.com...');
  
  const managerId = 'e716423e-93b7-424e-8ec2-2efed4deb6f8';
  const managerEmail = 'manager@riofish.com';
  
  const managerProfileData = {
    id: managerId,
    first_name: 'Manager',
    last_name: 'User',
    role: 'processor',
    is_active: true,
    email: managerEmail,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const { data: managerProfile, error: managerProfileError } = await supabase
    .from('profiles')
    .insert([managerProfileData])
    .select();
  
  if (managerProfileError) {
    if (managerProfileError.code === '23505') {
      console.log('🔄 Manager profile already exists, updating...');
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: 'Manager',
          last_name: 'User',
          role: 'processor',
          is_active: true,
          email: managerEmail,
          updated_at: new Date().toISOString()
        })
        .eq('id', managerId);
        
      if (updateError) {
        console.error('❌ Error updating manager profile:', updateError.message);
      } else {
        console.log('✅ Manager profile updated successfully');
      }
    } else {
      console.error('❌ Error creating manager profile:', managerProfileError.message);
    }
  } else {
    console.log('✅ Manager profile created successfully');
  }
  
  // Create default roles
  console.log('\n👥 Creating default roles...');
  await createDefaultRoles();
  
  console.log('\n🎉 Setup completed!');
  console.log('You can now log in with:');
  console.log('- mitchellkinoti@gmail.com (admin role)');
  console.log('- manager@riofish.com (processor role)');
}

async function createDefaultRoles() {
  const defaultRoles = [
    {
      name: 'admin',
      display_name: 'Administrator',
      description: 'Full system access and control. Can manage all users, roles, and system settings.',
      permissions: JSON.stringify(['*']),
      icon: 'Crown',
      color: 'bg-red-100 text-red-800 border-red-200',
      is_active: true
    },
    {
      name: 'processor',
      display_name: 'Fish Processor',
      description: 'Manages fish processing operations, quality control, and production workflows.',
      permissions: JSON.stringify(['read:all', 'write:processing', 'write:quality', 'read:inventory']),
      icon: 'Package',
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      is_active: true
    },
    {
      name: 'viewer',
      display_name: 'Viewer',
      description: 'Read-only access to system data. Cannot modify any information.',
      permissions: JSON.stringify(['read:basic']),
      icon: 'Eye',
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      is_active: true
    }
  ];
  
  for (const role of defaultRoles) {
    const { error } = await supabase
      .from('user_roles')
      .upsert(role, { onConflict: 'name' });
    
    if (error) {
      console.error(`❌ Error creating role ${role.name}:`, error.message);
    } else {
      console.log(`✅ Role ${role.name} created/updated`);
    }
  }
}

createProfileForUser();
