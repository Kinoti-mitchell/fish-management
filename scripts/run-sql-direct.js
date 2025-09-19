#!/usr/bin/env node

/**
 * Run SQL Direct - Execute SQL statements directly via Supabase REST API
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

async function executeSQL(sql) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
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
      return { success: true };
    } else {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Executing outlet receiving authentication fix...\n');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'fix_outlet_receiving_auth.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 SQL Content to execute:');
    console.log('='.repeat(80));
    console.log(sqlContent);
    console.log('='.repeat(80));
    
    // Try to execute the entire SQL block
    console.log('\n⏳ Executing SQL...');
    const result = await executeSQL(sqlContent);
    
    if (result.success) {
      console.log('✅ SQL executed successfully!');
    } else {
      console.log('⚠️  SQL execution warning:', result.error);
    }
    
    // Test the functions
    console.log('\n🔍 Testing functions...');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    try {
      const { data, error } = await supabase.rpc('get_outlet_receiving_records');
      if (error) {
        console.log('⚠️  Function test warning:', error.message);
      } else {
        console.log('✅ Functions are working!');
        console.log(`📊 Found ${data?.length || 0} records`);
      }
    } catch (err) {
      console.log('⚠️  Function test error:', err.message);
    }
    
    console.log('\n🎉 Process completed!');
    console.log('\n📋 Next steps:');
    console.log('1. If you see warnings, the SQL may need to be run manually in Supabase SQL Editor');
    console.log('2. Test your application: npm run dev');
    console.log('3. Try using the outlet receiving functionality');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().catch(console.error);
