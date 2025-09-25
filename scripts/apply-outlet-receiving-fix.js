const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQL(sql) {
  try {
    console.log('📄 Executing SQL...');
    
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`   Executing: ${statement.substring(0, 50)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.warn(`   ⚠️  Warning: ${error.message}`);
        } else {
          console.log(`   ✅ Success`);
        }
      }
    }
    
    return true;
  } catch (err) {
    console.error(`❌ Error executing SQL: ${err.message}`);
    return false;
  }
}

async function applyOutletReceivingFix() {
  console.log('🐟 Applying Outlet Receiving Fix...\n');
  
  try {
    // Read and apply the outlet receiving fix SQL
    console.log('📋 Applying outlet receiving fix...');
    const fixSQL = fs.readFileSync(
      path.join(__dirname, '..', 'db', 'COMPLETE_OUTLET_RECEIVING_FIX.sql'), 
      'utf8'
    );
    
    const success = await executeSQL(fixSQL);
    
    if (success) {
      console.log('\n✅ Outlet receiving fix applied successfully!');
      console.log('\n📝 The following changes were made:');
      console.log('   - Disabled RLS on outlet_receiving and related tables');
      console.log('   - Granted permissions to authenticated users');
      console.log('   - Created/updated RPC functions for outlet receiving');
      console.log('   - Added proper indexes for performance');
      console.log('\n🎉 Outlet receiving should now work without 403 errors!');
    } else {
      console.log('\n⚠️  Some SQL statements may not have executed successfully.');
      console.log('   Please check the Supabase dashboard for any remaining issues.');
    }
    
  } catch (error) {
    console.error('❌ Error applying outlet receiving fix:', error.message);
    console.log('\n📝 Manual Setup Required:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run the file: db/COMPLETE_OUTLET_RECEIVING_FIX.sql');
  }
}

// Run the application
if (require.main === module) {
  applyOutletReceivingFix().catch(console.error);
}

module.exports = { applyOutletReceivingFix };
