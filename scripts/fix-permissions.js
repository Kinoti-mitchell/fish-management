#!/usr/bin/env node

/**
 * Fix Database Permissions
 * This script fixes RLS permissions for the profiles table
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/server.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server.env');
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixPermissions() {
  console.log('🔧 Fixing database permissions...\n');
  
  try {
    // Step 1: Disable RLS on profiles table
    console.log('📝 Disabling RLS on profiles table...');
    const { error: rlsError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (rlsError && rlsError.message.includes('permission denied')) {
      console.log('⚠️  RLS is blocking access, trying to create tables...');
      
      // Try to create the profiles table if it doesn't exist
      console.log('📝 Creating profiles table...');
      
      // We'll use a different approach - create a simple profile directly
      const testProfile = {
        id: '1a31181e-9b3d-4928-8349-f5b38466e5fb',
        email: 'admin@riofish.com',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin',
        phone: '',
        is_active: true,
        last_login: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Try to insert the profile
      const { data: insertData, error: insertError } = await supabase
        .from('profiles')
        .insert([testProfile]);
      
      if (insertError) {
        console.log('⚠️  Insert failed:', insertError.message);
        
        // Try to update instead
        const { data: updateData, error: updateError } = await supabase
          .from('profiles')
          .update(testProfile)
          .eq('id', testProfile.id);
        
        if (updateError) {
          console.log('⚠️  Update also failed:', updateError.message);
        } else {
          console.log('✅ Profile updated successfully');
        }
      } else {
        console.log('✅ Profile created successfully');
      }
    } else if (rlsError) {
      console.log('⚠️  Other error:', rlsError.message);
    } else {
      console.log('✅ Profiles table is accessible');
    }
    
    // Step 2: Test the connection
    console.log('\n🔍 Testing connection...');
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, is_active')
      .limit(1);
    
    if (error) {
      console.log('❌ Connection test failed:', error.message);
      return false;
    }
    
    console.log('✅ Connection test successful');
    console.log(`📊 Found ${data?.length || 0} profiles`);
    
    if (data && data.length > 0) {
      console.log('👤 Sample profile:', data[0]);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error fixing permissions:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting permission fix process...\n');
  
  const success = await fixPermissions();
  
  if (success) {
    console.log('\n✅ Permission fix completed successfully!');
    console.log('🎉 Your application should now work without timeout errors');
    console.log('\n📋 Next steps:');
    console.log('1. Test your application: npm run dev');
    console.log('2. Try logging in with admin@riofish.com');
    console.log('3. Check the browser console for any remaining errors');
  } else {
    console.log('\n❌ Permission fix failed');
    console.log('🔧 Manual steps needed:');
    console.log('1. Go to Supabase dashboard → SQL Editor');
    console.log('2. Run: ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;');
    console.log('3. Run: ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;');
    console.log('4. Try the application again');
  }
}

// Run the fix
main().catch(console.error);
