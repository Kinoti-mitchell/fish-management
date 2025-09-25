const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

async function fixQuantityType() {
  try {
    // Get Supabase credentials - using known values from error message
    const supabaseUrl = 'https://pgpazwlejhysxabtkifz.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBncGF6d2xlamh5c3hhYnRraWZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjI0NzQwMCwiZXhwIjoyMDUxODIzNDAwfQ.placeholder';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('Fixing requested_quantity type from INTEGER to DECIMAL...');
    
    // Execute the SQL to alter the column type
    const { data, error } = await supabase
      .from('outlet_orders')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Error accessing outlet_orders table:', error);
      return;
    }
    
    // Use raw SQL execution
    const { data: result, error: sqlError } = await supabase.rpc('exec', {
      sql: `
        ALTER TABLE outlet_orders 
        ALTER COLUMN requested_quantity TYPE DECIMAL(10,2);
        
        COMMENT ON COLUMN outlet_orders.requested_quantity IS 'Total quantity requested in kg (supports decimal values)';
      `
    });
    
    if (sqlError) {
      console.error('Error executing SQL:', sqlError);
    } else {
      console.log('Successfully updated requested_quantity column type to DECIMAL(10,2)');
    }
    
  } catch (err) {
    console.error('Failed to fix quantity type:', err);
  }
}

fixQuantityType();
