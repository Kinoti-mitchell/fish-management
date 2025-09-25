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

async function fixInventoryColumns() {
  try {
    console.log('🔧 Adding missing reference_type column to inventory_entries...');
    
    // Add the reference_type column
    const addColumnSQL = `
      ALTER TABLE inventory_entries 
      ADD COLUMN IF NOT EXISTS reference_type TEXT;
    `;
    
    const { error: columnError } = await supabase.rpc('exec', { sql: addColumnSQL });
    
    if (columnError) {
      console.error('❌ Error adding reference_type column:', columnError);
      return false;
    }
    
    console.log('✅ Successfully added reference_type column');
    
    // Add other missing columns
    const otherColumns = [
      'fish_type TEXT',
      'quantity INTEGER', 
      'unit_weight DECIMAL(10,2)',
      'total_weight DECIMAL(10,2)',
      'size_distribution JSONB',
      'storage_location TEXT',
      'quality_grade TEXT',
      'entry_date DATE',
      'created_by UUID REFERENCES users(id)'
    ];
    
    for (const column of otherColumns) {
      const sql = `ALTER TABLE inventory_entries ADD COLUMN IF NOT EXISTS ${column};`;
      const { error } = await supabase.rpc('exec', { sql });
      
      if (error) {
        console.error(`❌ Error adding column ${column}:`, error);
        return false;
      }
    }
    
    console.log('✅ Successfully added all missing columns');
    
    // Add indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_inventory_entries_reference_type ON inventory_entries(reference_type);',
      'CREATE INDEX IF NOT EXISTS idx_inventory_entries_fish_type ON inventory_entries(fish_type);',
      'CREATE INDEX IF NOT EXISTS idx_inventory_entries_storage_location ON inventory_entries(storage_location);',
      'CREATE INDEX IF NOT EXISTS idx_inventory_entries_created_by ON inventory_entries(created_by);',
      'CREATE INDEX IF NOT EXISTS idx_inventory_entries_entry_date ON inventory_entries(entry_date);'
    ];
    
    for (const indexSQL of indexes) {
      const { error } = await supabase.rpc('exec', { sql: indexSQL });
      
      if (error) {
        console.error(`❌ Error creating index:`, error);
        return false;
      }
    }
    
    console.log('✅ Successfully created indexes');
    
    // Grant permissions
    const grantSQL = `
      GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_entries TO authenticated;
      GRANT USAGE ON SCHEMA public TO authenticated;
    `;
    
    const { error: grantError } = await supabase.rpc('exec', { sql: grantSQL });
    
    if (grantError) {
      console.error('❌ Error granting permissions:', grantError);
      return false;
    }
    
    console.log('✅ Successfully granted permissions');
    console.log('🎉 All inventory columns fixes applied successfully!');
    
    return true;
  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
}

// Run the fix
fixInventoryColumns().then(success => {
  if (success) {
    console.log('✅ Database fix completed successfully');
  } else {
    console.log('❌ Database fix failed');
    process.exit(1);
  }
});
