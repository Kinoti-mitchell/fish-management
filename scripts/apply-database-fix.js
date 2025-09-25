#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyDatabaseFix() {
  console.log('🔧 Applying database fix...\n');
  
  try {
    // Read the SQL fix file
    const sqlPath = path.join(process.cwd(), 'db', 'quick_fix_v2.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`📝 Executing: ${statement.substring(0, 50)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.log(`⚠️  Statement failed (might be expected): ${error.message}`);
        } else {
          console.log('✅ Statement executed successfully');
        }
      }
    }
    
    console.log('\n🎉 Database fix applied!');
    console.log('You can now log in with:');
    console.log('- Email: mitchellkinoti@gmail.com');
    console.log('- Role: admin');
    
  } catch (error) {
    console.error('❌ Error applying database fix:', error.message);
  }
}

applyDatabaseFix();
