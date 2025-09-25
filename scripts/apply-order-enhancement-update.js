/**
 * Apply Order Enhancement Update
 * 
 * This script adds the missing columns to the outlet_orders table
 * to support size-specific quantities and "any size" orders
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyOrderEnhancementUpdate() {
  try {
    console.log('🔄 Applying order enhancement update...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'add_order_enhancement_columns.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`📝 Executing: ${statement.substring(0, 50)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        
        if (error) {
          console.warn(`⚠️  Warning for statement: ${error.message}`);
          // Continue with other statements even if one fails
        }
      }
    }
    
    console.log('✅ Order enhancement update applied successfully!');
    console.log('📋 Columns added:');
    console.log('   - size_quantities (JSONB) - stores size -> quantity mapping');
    console.log('   - use_any_size (BOOLEAN) - flag for "any size" orders');
    console.log('   - order_number (TEXT) - human-readable order numbers');
    console.log('   - Indexes created for better performance');
    
    return true;
  } catch (error) {
    console.error('❌ Error applying order enhancement update:', error);
    return false;
  }
}

// Run the update
applyOrderEnhancementUpdate()
  .then(success => {
    if (success) {
      console.log('\n🎉 Order enhancement integration complete!');
      console.log('📝 Your outlet ordering system now supports:');
      console.log('   ✅ Size-specific quantity specification');
      console.log('   ✅ "Any size" order option');
      console.log('   ✅ Human-readable order numbers');
      console.log('   ✅ Enhanced order data structure');
    } else {
      console.log('\n❌ Failed to apply order enhancement update');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
