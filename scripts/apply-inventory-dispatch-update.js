/**
 * Apply Inventory Dispatch Update
 * 
 * This script applies the database functions needed for inventory-aware order dispatch
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

async function applyInventoryDispatchUpdate() {
  try {
    console.log('🔄 Applying inventory dispatch update...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'update_inventory_on_dispatch.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error('❌ Error applying inventory dispatch update:', error);
      return false;
    }
    
    console.log('✅ Inventory dispatch update applied successfully!');
    console.log('📋 Functions created:');
    console.log('   - update_inventory_on_dispatch()');
    console.log('   - check_inventory_availability()');
    console.log('   - get_inventory_summary_for_orders()');
    
    return true;
  } catch (error) {
    console.error('❌ Error applying inventory dispatch update:', error);
    return false;
  }
}

// Run the update
applyInventoryDispatchUpdate()
  .then(success => {
    if (success) {
      console.log('\n🎉 Inventory dispatch integration complete!');
      console.log('📝 Your outlet ordering system now:');
      console.log('   ✅ Shows real-time inventory availability');
      console.log('   ✅ Validates stock before creating orders');
      console.log('   ✅ Updates inventory when orders are dispatched');
      console.log('   ✅ Tracks inventory movement history');
    } else {
      console.log('\n❌ Failed to apply inventory dispatch update');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
