const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pgpazwlejhysxabtkifz.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSQLScript() {
  try {
    console.log('Reading SQL script...');
    const sqlScript = fs.readFileSync(path.join(__dirname, '../db/FIX_DISPOSAL_ISSUES_COMPLETE.sql'), 'utf8');
    
    console.log('Executing SQL script...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlScript });
    
    if (error) {
      console.error('Error executing SQL script:', error);
      process.exit(1);
    }
    
    console.log('SQL script executed successfully!');
    console.log('Data returned:', data);
    
  } catch (error) {
    console.error('Error running SQL script:', error);
    process.exit(1);
  }
}

// Alternative approach: execute SQL directly
async function executeSQLDirectly() {
  try {
    console.log('Reading SQL script...');
    const sqlScript = fs.readFileSync(path.join(__dirname, '../db/FIX_DISPOSAL_ISSUES_COMPLETE.sql'), 'utf8');
    
    // Split the script into individual statements
    const statements = sqlScript
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          const { data, error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
          if (error) {
            console.warn(`Warning in statement ${i + 1}:`, error.message);
          } else {
            console.log(`Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.warn(`Error in statement ${i + 1}:`, err.message);
        }
      }
    }
    
    console.log('All SQL statements processed!');
    
  } catch (error) {
    console.error('Error executing SQL statements:', error);
    process.exit(1);
  }
}

// Check if we have the exec_sql function, otherwise use direct approach
async function main() {
  try {
    // Try the direct approach first
    await executeSQLDirectly();
  } catch (error) {
    console.error('Failed to execute SQL:', error);
    console.log('\nPlease run the SQL script manually in your Supabase dashboard:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of db/FIX_DISPOSAL_ISSUES_COMPLETE.sql');
    console.log('4. Execute the script');
  }
}

main();
