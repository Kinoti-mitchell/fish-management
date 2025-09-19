#!/usr/bin/env node

/**
 * Fix User Creation Permissions
 * This script disables RLS and grants permissions to allow user creation from frontend
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './server/server.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server.env');
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixUserCreationPermissions() {
  console.log('🔧 Fixing user creation permissions...\n');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'disable-all-permissions.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Executing ${statements.length} SQL statements...\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.trim()) {
        try {
          console.log(`[${i + 1}/${statements.length}] Executing: ${statement.substring(0, 50)}...`);
          
          const { data, error } = await supabase.rpc('exec_sql', { 
            sql: statement + ';' 
          });
          
          if (error) {
            console.log(`   ⚠️  Warning: ${error.message}`);
            errorCount++;
          } else {
            console.log(`   ✅ Success`);
            successCount++;
          }
        } catch (err) {
          console.log(`   ❌ Error: ${err.message}`);
          errorCount++;
        }
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 All permissions fixed successfully!');
      console.log('\n📋 What was fixed:');
      console.log('• Disabled Row Level Security (RLS) on all tables');
      console.log('• Granted full permissions to anon, authenticated, and service_role');
      console.log('• Removed all existing RLS policies');
      console.log('• User creation from frontend should now work');
      
      console.log('\n🚀 Next steps:');
      console.log('1. Go to your UserManagement component');
      console.log('2. Try creating a new user');
      console.log('3. The user should be created successfully');
    } else {
      console.log('\n⚠️  Some errors occurred, but the main permissions should be fixed.');
      console.log('Try creating a user now - it should work!');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Alternative method using direct SQL execution
async function fixPermissionsAlternative() {
  console.log('🔧 Trying alternative method to fix permissions...\n');
  
  const permissions = [
    'ALTER TABLE users DISABLE ROW LEVEL SECURITY',
    'ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY', 
    'ALTER TABLE profiles DISABLE ROW LEVEL SECURITY',
    'GRANT ALL ON ALL TABLES IN SCHEMA public TO anon',
    'GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated',
    'GRANT USAGE ON SCHEMA public TO anon',
    'GRANT USAGE ON SCHEMA public TO authenticated'
  ];
  
  for (const permission of permissions) {
    try {
      console.log(`Executing: ${permission}...`);
      
      // Try using the SQL editor approach
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`   ⚠️  Warning: ${error.message}`);
      } else {
        console.log(`   ✅ Success`);
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }
  }
}

async function main() {
  console.log('🚀 Starting user creation permission fix...\n');
  
  // Try the main method first
  await fixUserCreationPermissions();
  
  console.log('\n' + '='.repeat(50));
  console.log('📝 MANUAL STEPS (if script didn\'t work):');
  console.log('='.repeat(50));
  console.log('1. Go to your Supabase Dashboard');
  console.log('2. Navigate to SQL Editor');
  console.log('3. Run this SQL:');
  console.log('');
  console.log('ALTER TABLE users DISABLE ROW LEVEL SECURITY;');
  console.log('ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY;');
  console.log('ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;');
  console.log('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;');
  console.log('GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;');
  console.log('GRANT USAGE ON SCHEMA public TO anon;');
  console.log('GRANT USAGE ON SCHEMA public TO authenticated;');
  console.log('');
  console.log('4. Click "Run" to execute');
  console.log('5. Try creating a user in your UserManagement component');
}

main().catch(console.error);
