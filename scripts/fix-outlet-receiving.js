const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qjqjqjqjqjqjqj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fs.readFileSync(path.join(__dirname, '../SUPABASE_SERVICE_ROLE_KEY'), 'utf8').trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function runOutletReceivingFix() {
  try {
    console.log('🔧 Starting outlet receiving fix...');
    
    // Read the comprehensive fix SQL
    const sqlPath = path.join(__dirname, '../db/COMPREHENSIVE_OUTLET_RECEIVING_FIX.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Executing SQL fix...');
    
    // Split the SQL into individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement.length === 0) continue;
      
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error);
          // Continue with other statements
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.error(`❌ Exception in statement ${i + 1}:`, err.message);
      }
    }
    
    console.log('🧪 Testing functions...');
    
    // Test get_outlet_receiving_records
    const { data: records, error: recordsError } = await supabase.rpc('get_outlet_receiving_records');
    if (recordsError) {
      console.error('❌ Error testing get_outlet_receiving_records:', recordsError);
    } else {
      console.log(`✅ get_outlet_receiving_records working - found ${records?.length || 0} records`);
    }
    
    // Test update_storage_capacity_from_inventory
    const { data: storageResult, error: storageError } = await supabase.rpc('update_storage_capacity_from_inventory');
    if (storageError) {
      console.error('❌ Error testing update_storage_capacity_from_inventory:', storageError);
    } else {
      console.log('✅ update_storage_capacity_from_inventory working');
    }
    
    console.log('🎉 Outlet receiving fix completed successfully!');
    
  } catch (error) {
    console.error('💥 Error running outlet receiving fix:', error);
    process.exit(1);
  }
}

// Run the fix
runOutletReceivingFix();
