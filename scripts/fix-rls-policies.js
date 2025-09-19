#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRLSPolicies() {
  console.log('🔧 Fixing RLS policies...\n');
  
  try {
    // First, let's try to create a test profile to see if we can bypass RLS
    console.log('📝 Testing profile creation...');
    
    const testProfile = {
      id: '00000000-0000-0000-0000-000000000001',
      first_name: 'Test',
      last_name: 'Admin',
      role: 'admin',
      is_active: true,
      email: 'test@riofish.com'
    };
    
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert([testProfile])
      .select();
    
    if (profileError) {
      console.error('❌ Profile creation failed:', profileError.message);
      
      // Try to create default roles first
      console.log('👥 Creating default roles...');
      await createDefaultRoles();
      
      // Try profile creation again
      const { data: retryData, error: retryError } = await supabase
        .from('profiles')
        .insert([testProfile])
        .select();
        
      if (retryError) {
        console.error('❌ Profile creation still failing:', retryError.message);
        console.log('\n🔧 Manual fix needed:');
        console.log('1. Go to Supabase dashboard → Authentication → Users');
        console.log('2. Create a user manually');
        console.log('3. The profile should be created automatically by the trigger');
      } else {
        console.log('✅ Profile created successfully on retry');
        // Clean up test profile
        await supabase.from('profiles').delete().eq('id', testProfile.id);
      }
    } else {
      console.log('✅ Profile created successfully');
      // Clean up test profile
      await supabase.from('profiles').delete().eq('id', testProfile.id);
    }
    
  } catch (error) {
    console.error('❌ Error fixing RLS policies:', error.message);
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
  
  const { error } = await supabase
    .from('user_roles')
    .insert(defaultRoles);
  
  if (error) {
    console.error('❌ Error creating default roles:', error.message);
    return false;
  } else {
    console.log('✅ Default roles created successfully');
    return true;
  }
}

fixRLSPolicies();
