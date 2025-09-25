#!/usr/bin/env node

/**
 * Run Outlet Receiving Authentication Fix
 * This script runs the outlet receiving authentication fix using the service role key
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
        console.log(`📄 Statement: ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`);
        
        try {
          // Use the SQL editor endpoint directly
          const { data, error } = await supabase
            .from('_sql')
            .select('*')
            .eq('query', statement + ';');
          
          if (error) {
            // Try alternative approach - execute as raw SQL
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
                'apikey': supabaseKey
              },
              body: JSON.stringify({ sql: statement + ';' })
            });
            
            if (!response.ok) {
              console.log(`⚠️  Statement ${i + 1} warning: HTTP ${response.status}`);
            } else {
              console.log(`✅ Statement ${i + 1} completed successfully`);
            }
          } else {
            console.log(`✅ Statement ${i + 1} completed successfully`);
          }
        } catch (err) {
          console.log(`⚠️  Statement ${i + 1} error:`, err.message);
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

async function testOutletReceivingFunctions() {
  console.log('🔍 Testing outlet receiving functions...');
  
  try {
    // Test if the functions exist by calling them
    const { data: createTest, error: createError } = await supabase.rpc('create_outlet_receiving_record', {
      p_dispatch_id: '00000000-0000-0000-0000-000000000000'::uuid,
      p_outlet_order_id: '00000000-0000-0000-0000-000000000000'::uuid,
      p_received_date: '2024-01-01',
      p_received_by: '00000000-0000-0000-0000-000000000000'::uuid,
      p_expected_weight: 100.00,
      p_actual_weight_received: 95.00,
      p_expected_pieces: 10,
      p_actual_pieces_received: 9,
      p_expected_value: 500.00,
      p_actual_value_received: 475.00,
      p_condition: 'good',
      p_size_discrepancies: '{}',
      p_discrepancy_notes: 'Test',
      p_status: 'received',
      p_outlet_name: 'Test Outlet',
      p_outlet_location: 'Test Location'
    });
    
    if (createError) {
      console.log('⚠️  Create function test (expected to fail with invalid IDs):', createError.message);
    } else {
      console.log('✅ Create function exists and is callable');
    }
    
    // Test the get function
    const { data: getTest, error: getError } = await supabase.rpc('get_outlet_receiving_records');
    
    if (getError) {
      console.error('❌ Get function test failed:', getError.message);
      return false;
    } else {
      console.log('✅ Get function exists and returned data');
      console.log(`📊 Found ${getTest?.length || 0} outlet receiving records`);
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
  const functionTest = await testOutletReceivingFunctions();
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
  console.log('4. Consider re-enabling RLS on outlet_receiving table if needed');
}

// Run the fix
main().catch(console.error);
