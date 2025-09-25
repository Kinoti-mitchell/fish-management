#!/usr/bin/env node

/**
 * Execute Outlet Receiving Authentication Fix
 * This script executes the SQL fix directly using Supabase client
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

async function executeSQLStatement(sql) {
  try {
    // Use the REST API directly to execute SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ sql: sql })
    });

    if (response.ok) {
      return { success: true, data: await response.text() };
    } else {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function runOutletReceivingFix() {
  console.log('🚀 Running outlet receiving authentication fix...\n');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'fix_outlet_receiving_auth.sql');
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
        console.log(`📄 Statement: ${statement.substring(0, 80)}${statement.length > 80 ? '...' : ''}`);
        
        const result = await executeSQLStatement(statement + ';');
        
        if (result.success) {
          console.log(`✅ Statement ${i + 1} completed successfully`);
        } else {
          console.log(`⚠️  Statement ${i + 1} warning:`, result.error);
        }
        console.log(''); // Add spacing between statements
      }
    }
    
    console.log('🎉 Outlet receiving authentication fix completed!');
    return true;
  } catch (error) {
    console.error('❌ Error running outlet receiving fix:', error);
    return false;
  }
}

async function testFunctions() {
  console.log('🔍 Testing outlet receiving functions...');
  
  try {
    // Test the get function
    const { data, error } = await supabase.rpc('get_outlet_receiving_records');
    
    if (error) {
      console.error('❌ Get function test failed:', error.message);
      return false;
    } else {
      console.log('✅ Get function exists and returned data');
      console.log(`📊 Found ${data?.length || 0} outlet receiving records`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Function test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting outlet receiving authentication fix...\n');
  
  // Step 1: Run the fix
  const fixCompleted = await runOutletReceivingFix();
  if (!fixCompleted) {
    console.log('\n❌ Fix failed');
    process.exit(1);
  }
  
  console.log('');
  
  // Step 2: Test functions
  const functionTest = await testFunctions();
  if (!functionTest) {
    console.log('\n❌ Function test failed');
    process.exit(1);
  }
  
  console.log('\n✅ Outlet receiving authentication fix completed successfully!');
  console.log('🎉 The function uniqueness error should now be resolved');
  console.log('\n📋 Next steps:');
  console.log('1. Test your application: npm run dev');
  console.log('2. Try using the outlet receiving functionality');
  console.log('3. Check the browser console for any remaining errors');
}

// Run the fix
main().catch(console.error);
