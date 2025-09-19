const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please check your .env file has VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyInventoryColumnsFix() {
  try {
    console.log('🔧 Adding missing columns to inventory_entries table...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'add_missing_inventory_columns.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('❌ Error applying inventory columns fix:', error);
      return false;
    }
    
    console.log('✅ Successfully added missing columns to inventory_entries table');
    
    // Now apply the trigger fix
    console.log('🔧 Updating outlet receiving trigger...');
    
    const triggerSqlPath = path.join(__dirname, '..', 'db', 'fix_outlet_receiving_trigger.sql');
    const triggerSql = fs.readFileSync(triggerSqlPath, 'utf8');
    
    const { error: triggerError } = await supabase.rpc('exec_sql', { sql_query: triggerSql });
    
    if (triggerError) {
      console.error('❌ Error applying trigger fix:', triggerError);
      return false;
    }
    
    console.log('✅ Successfully updated outlet receiving trigger');
    console.log('🎉 All fixes applied successfully! Your outlet receiving should work now.');
    
    return true;
  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
}

// Run the fix
applyInventoryColumnsFix().then(success => {
  if (success) {
    console.log('✅ Database fix completed successfully');
  } else {
    console.log('❌ Database fix failed');
    process.exit(1);
  }
});
