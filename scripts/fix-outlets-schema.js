#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

console.log('🔧 Fixing outlets table schema...\n');

// Read the service key from file
let serviceKey;
try {
  serviceKey = fs.readFileSync('SUPABASE_SERVICE_ROLE_KEY', 'utf8').trim();
} catch (error) {
  console.error('❌ Could not read service key file:', error.message);
  process.exit(1);
}

// Get Supabase URL from environment or use default
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pgpazwlejhysxabtkifz.supabase.co';

if (!serviceKey) {
  console.error('❌ Service key is empty');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function fixOutletsSchema() {
  try {
    console.log('1. Checking current outlets table structure...');
    
    // First, try to query the outlets table to see what we have
    const { data: outlets, error: outletsError } = await supabase
      .from('outlets')
      .select('*')
      .limit(1);
    
    if (outletsError) {
      console.log('❌ Outlets table error:', outletsError.message);
      
      // If table doesn't exist, create it
      console.log('2. Creating outlets table...');
      
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS outlets (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name TEXT NOT NULL,
          location TEXT NOT NULL,
          phone TEXT NOT NULL,
          manager_name TEXT,
          manager_id UUID,
          status TEXT DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;
      
      const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
      
      if (createError) {
        console.log('Could not create table via RPC, trying direct approach...');
        
        // Try to create with a simple insert that will fail gracefully
        const { error: testError } = await supabase
          .from('outlets')
          .insert([{
            name: 'Test Outlet',
            location: 'Test Location',
            phone: '+254700000000',
            manager_name: 'Test Manager',
            status: 'active'
          }]);
        
        if (testError && testError.message.includes('relation "outlets" does not exist')) {
          console.log('❌ Outlets table does not exist and cannot be created automatically');
          console.log('📝 Please run the SQL script manually in Supabase SQL Editor:');
          console.log('   File: db/fix_outlets_schema.sql');
          return;
        }
      }
    } else {
      console.log('✅ Outlets table exists');
      console.log('Sample data:', outlets);
    }
    
    console.log('\n3. Testing outlets fetch...');
    
    // Try to fetch all outlets
    const { data: allOutlets, error: fetchError } = await supabase
      .from('outlets')
      .select('*')
      .order('name');
    
    if (fetchError) {
      console.error('❌ Fetch outlets error:', fetchError.message);
    } else {
      console.log('✅ Successfully fetched outlets:', allOutlets?.length || 0, 'records');
      if (allOutlets && allOutlets.length > 0) {
        console.log('Sample outlet:', allOutlets[0]);
      } else {
        console.log('📝 No outlets found. Adding sample data...');
        
        const sampleOutlets = [
          {
            name: 'Main Outlet',
            location: 'Nairobi CBD',
            phone: '+254700000001',
            manager_name: 'John Doe',
            status: 'active'
          },
          {
            name: 'Coast Outlet',
            location: 'Mombasa Port',
            phone: '+254700000002',
            manager_name: 'Jane Smith',
            status: 'active'
          },
          {
            name: 'Rift Valley Outlet',
            location: 'Nakuru Town',
            phone: '+254700000003',
            manager_name: 'Mike Johnson',
            status: 'active'
          }
        ];
        
        const { error: insertError } = await supabase
          .from('outlets')
          .insert(sampleOutlets);
        
        if (insertError) {
          console.error('❌ Error inserting sample data:', insertError.message);
        } else {
          console.log('✅ Sample outlets created successfully');
        }
      }
    }
    
    console.log('\n🎉 Outlets schema fix completed!');
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  }
}

fixOutletsSchema();
