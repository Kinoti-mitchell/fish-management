const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorageLocations() {
  try {
    console.log('Setting up storage_locations table...');
    
    // Read the SQL file
    const fs = require('fs');
    const path = require('path');
    const sqlPath = path.join(__dirname, '../db/create_storage_locations.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Error creating storage_locations table:', error);
      return;
    }
    
    console.log('✅ storage_locations table created successfully!');
    
    // Verify the table was created by fetching some data
    const { data: locations, error: fetchError } = await supabase
      .from('storage_locations')
      .select('*')
      .limit(5);
    
    if (fetchError) {
      console.error('Error fetching storage locations:', fetchError);
      return;
    }
    
    console.log('📦 Sample storage locations:');
    locations.forEach(location => {
      console.log(`  - ${location.name} (${location.location_type}) - ${location.current_usage_kg}/${location.capacity_kg} kg`);
    });
    
  } catch (error) {
    console.error('Setup failed:', error);
  }
}

setupStorageLocations();
