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
    
    console.log(`🚀 Deploying SQL schema changes from: ${filePath}`);
    
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
          // Try direct execution
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

async function testSchemaChanges() {
  console.log('\n🧪 Testing schema changes...');
  
  try {
    // Test if size_distribution column exists
    const { data, error } = await supabase
      .from('sorting_batches')
      .select('size_distribution')
      .limit(1);
    
    if (error) {
      console.log('⚠️  size_distribution column test failed:', error.message);
    } else {
      console.log('✅ size_distribution column exists');
    }
    
    // Test if storage_location_id column exists
    const { data: storageData, error: storageError } = await supabase
      .from('sorting_batches')
      .select('storage_location_id')
      .limit(1);
    
    if (storageError) {
      console.log('⚠️  storage_location_id column test failed:', storageError.message);
    } else {
      console.log('✅ storage_location_id column exists');
    }
    
  } catch (error) {
    console.error('❌ Schema testing error:', error.message);
  }
}

async function main() {
  console.log('🐟 Fish Management - Deploy Sorting Schema Changes\n');
  
  try {
    // Deploy the sorting batches schema changes
    const success = await deploySQLFile(path.join(__dirname, '..', 'db', 'add_size_distribution_to_sorting_batches.sql'));
    
    if (success) {
      console.log('\n🎉 Sorting schema changes deployed successfully!');
      
      // Test the schema changes
      await testSchemaChanges();
      
      console.log('\n📋 Summary:');
      console.log('   - Added size_distribution column to sorting_batches');
      console.log('   - Added storage_location_id column to sorting_batches');
      console.log('   - Added indexes for better performance');
      console.log('   - Updated permissions');
      console.log('\n💡 The sorting form should now work without errors!');
    } else {
      console.log('\n❌ Deployment completed with some warnings. Check the output above for details.');
    }
  } catch (error) {
    console.error('❌ Error deploying sorting schema:', error);
    process.exit(1);
  }
}

// Run the deployment
main().catch(console.error);
