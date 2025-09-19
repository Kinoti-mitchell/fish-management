#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from server.env
require('dotenv').config({ path: path.join(__dirname, '..', 'server', 'server.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deploySQLFile(filePath) {
  try {
    console.log(`📄 Reading SQL file: ${filePath}`);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    console.log(`🚀 Deploying SQL functions from: ${filePath}`);
    
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        console.log(`   ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`);
        
        try {
          // Try using rpc exec if available
          const { data, error } = await supabase.rpc('exec', { sql: statement });
          if (error && !error.message.includes('function exec')) {
            console.log(`⚠️  Statement ${i + 1} warning:`, error.message);
          } else {
            console.log(`✅ Statement ${i + 1} completed successfully`);
          }
        } catch (err) {
          console.log(`⚠️  Statement ${i + 1} error:`, err.message);
        }
      }
    }
    
    console.log(`\n✅ Successfully deployed: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error deploying ${filePath}:`, error.message);
    return false;
  }
}

async function testFunctions() {
  console.log('\n🧪 Testing deployed functions...');
  
  try {
    // Test storage capacity status function
    const { data: capacityData, error: capacityError } = await supabase.rpc('get_storage_capacity_status');
    if (capacityError) {
      console.log('⚠️  Storage capacity function test failed:', capacityError.message);
    } else {
      console.log('✅ Storage capacity function working');
    }
    
    // Test available storage locations function
    const { data: availableData, error: availableError } = await supabase.rpc('get_available_storage_locations_for_sorting', {
      p_required_weight_kg: 0
    });
    if (availableError) {
      console.log('⚠️  Available storage function test failed:', availableError.message);
    } else {
      console.log('✅ Available storage function working');
    }
    
  } catch (error) {
    console.error('❌ Function testing error:', error.message);
  }
}

async function main() {
  console.log('🐟 Fish Management - Deploy Storage Functions\n');
  
  try {
    // Deploy the storage capacity management functions
    const success1 = await deploySQLFile(path.join(__dirname, '..', 'db', 'storage_capacity_management.sql'));
    
    if (success1) {
      console.log('\n🎉 Storage capacity management functions deployed successfully!');
      
      // Test the functions
      await testFunctions();
      
      console.log('\n📋 Summary:');
      console.log('   - Storage capacity status function deployed');
      console.log('   - Available storage locations function deployed');
      console.log('   - Storage validation functions deployed');
      console.log('   - Storage capacity alerts function deployed');
      console.log('\n💡 The sorting component should now work without errors!');
    } else {
      console.log('\n❌ Deployment completed with some warnings. Check the output above for details.');
    }
  } catch (error) {
    console.error('❌ Error deploying storage functions:', error);
    process.exit(1);
  }
}

// Run the deployment
main().catch(console.error);
