// Script to fix disposal system permissions and functions
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDisposalSystem() {
  console.log('🔧 Fixing Disposal System...\n');

  try {
    // Read the fix script
    const fixScript = fs.readFileSync('db/DISPOSAL_MINIMAL_FIX.sql', 'utf8');
    
    // Split the script into individual statements
    const statements = fixScript
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.includes('CREATE TABLE') || statement.includes('INSERT INTO') || statement.includes('ALTER TABLE') || statement.includes('GRANT') || statement.includes('CREATE OR REPLACE FUNCTION')) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          
          if (error) {
            console.log(`⚠️  Statement ${i + 1} warning:`, error.message);
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.log(`❌ Statement ${i + 1} failed:`, err.message);
        }
      }
    }

    console.log('\n🧪 Testing the fix...');
    
    // Test if disposal tables are now accessible
    const { data: disposalReasons, error: reasonsError } = await supabase
      .from('disposal_reasons')
      .select('count')
      .limit(1);
    
    if (reasonsError) {
      console.log('❌ disposal_reasons still has issues:', reasonsError.message);
    } else {
      console.log('✅ disposal_reasons table is now accessible');
    }

    // Test if disposal function works
    const { data: inventoryData, error: inventoryError } = await supabase
      .rpc('get_inventory_for_disposal', {
        p_days_old: 30,
        p_include_storage_issues: true
      });
    
    if (inventoryError) {
      console.log('❌ get_inventory_for_disposal function still has issues:', inventoryError.message);
    } else {
      console.log('✅ get_inventory_for_disposal function is now working');
      console.log(`   Found ${inventoryData?.length || 0} items for disposal`);
    }

    console.log('\n🎉 Disposal system fix completed!');
    console.log('💡 You may need to refresh your browser to see the changes.');

  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    console.log('\n💡 Manual fix required:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Open the SQL Editor');
    console.log('3. Run the contents of db/DISPOSAL_MINIMAL_FIX.sql');
  }
}

fixDisposalSystem();

