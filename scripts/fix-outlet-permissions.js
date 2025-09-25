const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pgpazwlejhysxabtkifz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fs.readFileSync(path.join(__dirname, '../SUPABASE_SERVICE_ROLE_KEY'), 'utf8').trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOutletPermissions() {
  try {
    console.log('🔧 Fixing outlet receiving inventory permissions...');
    
    // Read the permission fix SQL
    const sqlPath = path.join(__dirname, '../db/FIX_OUTLET_RECEIVING_INVENTORY_PERMISSIONS.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Executing permission fixes...');
    
    // Split the SQL into individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement.length === 0) continue;
      
      try {
        // Try to execute each statement
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.error(`❌ Exception in statement ${i + 1}:`, err.message);
      }
    }
    
    // Test access to the table
    console.log('🧪 Testing table access...');
    const { data, error: testError } = await supabase
      .from('outlet_receiving_inventory')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('❌ Still cannot access outlet_receiving_inventory:', testError.message);
    } else {
      console.log('✅ Successfully accessed outlet_receiving_inventory table');
    }
    
    console.log('🎉 Permission fix completed!');
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

fixOutletPermissions();
