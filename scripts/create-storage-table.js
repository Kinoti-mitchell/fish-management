const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.log('Make sure you have VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createStorageLocationsTable() {
  try {
    console.log('Creating storage_locations table...');
    
    // Create the table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS storage_locations (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        capacity_kg DECIMAL(10,2) NOT NULL DEFAULT 1000.00,
        current_usage_kg DECIMAL(10,2) DEFAULT 0.00,
        temperature_celsius DECIMAL(4,2) DEFAULT 4.00,
        humidity_percent DECIMAL(5,2) DEFAULT 85.00,
        location_type VARCHAR(50) DEFAULT 'cold_storage' CHECK (location_type IN ('cold_storage', 'freezer', 'ambient', 'processing_area')),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    // Create indexes
    const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_storage_locations_name ON storage_locations(name);
      CREATE INDEX IF NOT EXISTS idx_storage_locations_status ON storage_locations(status);
      CREATE INDEX IF NOT EXISTS idx_storage_locations_type ON storage_locations(location_type);
    `;
    
    // Insert default data
    const insertDataSQL = `
      INSERT INTO storage_locations (name, description, capacity_kg, location_type) VALUES
      ('Cold Storage A', 'Primary cold storage unit for processed fish', 2000.00, 'cold_storage'),
      ('Cold Storage B', 'Secondary cold storage unit', 1500.00, 'cold_storage'),
      ('Freezer Unit 1', 'Deep freeze storage for long-term storage', 1000.00, 'freezer'),
      ('Processing Area 1', 'Temporary storage during processing', 500.00, 'processing_area'),
      ('Processing Area 2', 'Secondary processing area storage', 500.00, 'processing_area')
      ON CONFLICT (name) DO NOTHING;
    `;
    
    // Execute the SQL statements
    console.log('Creating table...');
    const { error: tableError } = await supabase.rpc('exec', { sql: createTableSQL });
    if (tableError) {
      console.error('Error creating table:', tableError);
      return;
    }
    
    console.log('Creating indexes...');
    const { error: indexError } = await supabase.rpc('exec', { sql: createIndexesSQL });
    if (indexError) {
      console.error('Error creating indexes:', indexError);
      return;
    }
    
    console.log('Inserting default data...');
    const { error: insertError } = await supabase.rpc('exec', { sql: insertDataSQL });
    if (insertError) {
      console.error('Error inserting data:', insertError);
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

createStorageLocationsTable();
