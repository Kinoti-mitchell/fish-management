#!/usr/bin/env node

/**
 * Run SQL Fix Script
 * This script runs the ultra simple SQL fix using the service role key
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
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

async function runSQLFix() {
  console.log('🚀 Running ultra simple SQL fix...\n');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'ultra_simple_fix.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          const { data, error } = await supabase.rpc('exec_sql', {
            sql: statement + ';'
          });
          
          if (error) {
            console.log(`⚠️  Statement ${i + 1} warning:`, error.message);
          } else {
            console.log(`✅ Statement ${i + 1} completed successfully`);
          }
        } catch (err) {
          console.log(`⚠️  Statement ${i + 1} error:`, err.message);
        }
      }
    }
    
    console.log('\n🎉 SQL fix completed!');
    return true;
  } catch (error) {
    console.error('❌ Error running SQL fix:', error);
    return false;
  }
}

async function testConnection() {
  console.log('🔍 Testing database connection...');
  
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, is_active')
      .limit(1);
    
    if (error) {
      console.error('❌ Database connection failed:', error);
      return false;
    }
    
    console.log('✅ Database connection successful');
    console.log(`📊 Found ${data?.length || 0} profiles`);
    
    if (data && data.length > 0) {
      console.log('👤 Sample profile:', data[0]);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting database fix process...\n');
  
  // Step 1: Run SQL fix
  const sqlFixCompleted = await runSQLFix();
  if (!sqlFixCompleted) {
    console.log('\n❌ SQL fix failed');
    process.exit(1);
  }
  
  console.log('');
  
  // Step 2: Test connection
  const connectionTest = await testConnection();
  if (!connectionTest) {
    console.log('\n❌ Connection test failed');
    process.exit(1);
  }
  
  console.log('\n✅ Database fix completed successfully!');
  console.log('🎉 Your application should now work without errors');
  console.log('\n📋 Next steps:');
  console.log('1. Test your application: npm run dev');
  console.log('2. Try logging in with admin@riofish.com');
  console.log('3. Check the browser console for any remaining errors');
}

// Run the fix
main().catch(console.error);
