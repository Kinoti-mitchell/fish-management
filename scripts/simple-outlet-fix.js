const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pgpazwlejhysxabtkifz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fs.readFileSync(path.join(__dirname, '../SUPABASE_SERVICE_ROLE_KEY'), 'utf8').trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSimpleFix() {
  try {
    console.log('🔧 Running simple outlet receiving fix...');
    
    // Read the simple fix SQL
    const sqlPath = path.join(__dirname, '../db/SIMPLE_OUTLET_RECEIVING_FIX.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Executing SQL...');
    
    // Execute the SQL directly using the service role
    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('❌ Error executing SQL:', error);
      
      // Try alternative approach - execute statements individually
      console.log('🔄 Trying alternative approach...');
      
      const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();
        if (statement.length === 0) continue;
        
        try {
          const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement });
          if (stmtError) {
            console.error(`❌ Error in statement ${i + 1}:`, stmtError.message);
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.error(`❌ Exception in statement ${i + 1}:`, err.message);
        }
      }
    } else {
      console.log('✅ SQL executed successfully');
    }
    
    // Test the function
    console.log('🧪 Testing get_outlet_receiving_records function...');
    const { data, error: testError } = await supabase.rpc('get_outlet_receiving_records');
    
    if (testError) {
      console.error('❌ Error testing function:', testError);
    } else {
      console.log(`✅ Function working! Found ${data?.length || 0} records`);
    }
    
    console.log('🎉 Simple fix completed!');
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

runSimpleFix();
