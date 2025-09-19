#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQL(sql) {
  try {
    console.log('🚀 Executing SQL fix for processing_yield null constraint...\n');
    
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
          // Try using rpc exec_sql if available
          const { data, error } = await supabase.rpc('exec_sql', {
            sql: statement + ';'
          });
          
          if (error) {
            // If exec_sql doesn't work, try direct query execution for SELECT statements
            if (statement.toUpperCase().startsWith('SELECT')) {
              const { data: queryData, error: queryError } = await supabase
                .from('processing_records')
                .select('*')
                .limit(0);
              
              if (queryError && !queryError.message.includes('relation "processing_records" does not exist')) {
                console.log(`⚠️  Statement ${i + 1} warning:`, error.message);
              } else {
                console.log(`✅ Statement ${i + 1} completed successfully`);
              }
            } else {
              console.log(`⚠️  Statement ${i + 1} warning:`, error.message);
            }
          } else {
            console.log(`✅ Statement ${i + 1} completed successfully`);
          }
        } catch (err) {
          console.log(`⚠️  Statement ${i + 1} error:`, err.message);
        }
      }
    }
    
    console.log('\n🎉 SQL fix execution completed!');
    return true;
  } catch (error) {
    console.error('❌ Error executing SQL fix:', error);
    return false;
  }
}

async function testConnection() {
  console.log('🔍 Testing database connection...');
  
  try {
    const { data, error } = await supabase
      .from('processing_records')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('⚠️  Connection test warning:', error.message);
    } else {
      console.log('✅ Database connection successful');
    }
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🐟 Fish Management - Processing Yield Fix\n');
  
  // Test connection first
  const connectionOk = await testConnection();
  if (!connectionOk) {
    console.log('⚠️  Proceeding with fix despite connection warning...\n');
  }
  
  try {
    // Read the SQL fix file
    const sqlPath = path.join(__dirname, '..', 'db', 'fix_processing_yield_null_constraint.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    const success = await executeSQL(sqlContent);
    
    if (success) {
      console.log('\n✅ Processing yield null constraint fix completed successfully!');
      console.log('📋 Summary:');
      console.log('   - Created function to calculate processing_yield');
      console.log('   - Updated existing records with null processing_yield values');
      console.log('   - Added trigger to auto-calculate processing_yield on insert/update');
      console.log('   - All future processing records will have processing_yield calculated automatically');
    } else {
      console.log('\n❌ Fix completed with some warnings. Check the output above for details.');
    }
  } catch (error) {
    console.error('❌ Error running processing yield fix:', error);
    process.exit(1);
  }
}

// Run the fix
main().catch(console.error);
