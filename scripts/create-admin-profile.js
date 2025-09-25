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

async function createAdminProfile() {
  console.log('👤 Creating admin profile for admin@rio.com...\n');
  
  try {
    // First, let's get the user ID from auth.users
    console.log('🔍 Finding user in auth.users...');
    
    // We need to use the admin API to list users
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      return;
    }
    
    const adminUser = users.users.find(user => user.email === 'admin@rio.com');
    
    if (!adminUser) {
      console.error('❌ User admin@rio.com not found in auth.users');
      console.log('Available users:');
      users.users.forEach(user => {
        console.log(`  - ${user.email} (${user.id})`);
      });
      return;
    }
    
    console.log('✅ Found user:', adminUser.email, 'ID:', adminUser.id);
    
    // Create profile for this user
    console.log('📝 Creating profile...');
    
    const profileData = {
      id: adminUser.id,
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin',
      is_active: true,
      email: adminUser.email,
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
            first_name: 'Admin',
            last_name: 'User',
            role: 'admin',
            is_active: true,
            email: adminUser.email,
            updated_at: new Date().toISOString()
          })
          .eq('id', adminUser.id)
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
    
    // Create default roles if they don't exist
    console.log('\n👥 Creating default roles...');
    await createDefaultRoles();
    
    console.log('\n🎉 Setup completed! You can now log in with admin@rio.com');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
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

createAdminProfile();
