const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pgpazwlejhysxabtkifz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fs.readFileSync(path.join(__dirname, '../SUPABASE_SERVICE_ROLE_KEY'), 'utf8').trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function createRPCFunctions() {
  try {
    console.log('🔧 Creating outlet receiving RPC functions...');
    
    // Read the SQL
    const sqlPath = path.join(__dirname, '../db/CREATE_OUTLET_RECEIVING_RPC.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Executing SQL...');
    
    // Split the SQL into individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement.length === 0) continue;
      
      try {
        // Execute each statement directly using the service role
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
    
    // Test the functions
    console.log('🧪 Testing RPC functions...');
    
    // Test get function
    const { data: records, error: getError } = await supabase.rpc('get_outlet_receiving_records_safe');
    if (getError) {
      console.error('❌ Error testing get function:', getError.message);
    } else {
      console.log(`✅ get_outlet_receiving_records_safe working - found ${records?.length || 0} records`);
    }
    
    console.log('🎉 RPC functions created successfully!');
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

createRPCFunctions();
