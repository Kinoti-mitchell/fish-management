const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read environment variables
require('dotenv').config();

// Get Supabase URL and service key
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pgpazwlejhysxabtkifz.supabase.co';
const serviceKey = fs.readFileSync('SUPABASE_SERVICE_ROLE_KEY', 'utf8').trim();

console.log('Testing outlets table access...');
console.log('Supabase URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, serviceKey);

async function testOutlets() {
  try {
    console.log('\n1. Testing basic connection...');
    
    // Test basic connection
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('Connection test failed:', testError);
      return;
    }
    console.log('✓ Connection successful');

    console.log('\n2. Checking outlets table structure...');
    
    // Check if outlets table exists and get its structure
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_columns', { table_name: 'outlets' });
    
    if (tableError) {
      console.log('Could not get table structure via RPC, trying direct query...');
      
      // Try to query the table directly
      const { data: outlets, error: outletsError } = await supabase
        .from('outlets')
        .select('*')
        .limit(1);
      
      if (outletsError) {
        console.error('Outlets table error:', outletsError);
        
        // Check if table exists at all
        const { data: tables, error: tablesError } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .eq('table_name', 'outlets');
        
        if (tablesError) {
          console.error('Could not check table existence:', tablesError);
        } else if (tables.length === 0) {
          console.log('❌ Outlets table does not exist');
          console.log('Available tables:');
          
          const { data: allTables, error: allTablesError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .order('table_name');
          
          if (!allTablesError && allTables) {
            allTables.forEach(table => console.log('  -', table.table_name));
          }
        } else {
          console.log('✓ Outlets table exists but has access issues');
        }
      } else {
        console.log('✓ Outlets table accessible');
        console.log('Sample data:', outlets);
      }
    } else {
      console.log('✓ Table structure:', tableInfo);
    }

    console.log('\n3. Testing outlets fetch...');
    
    // Try to fetch all outlets
    const { data: allOutlets, error: fetchError } = await supabase
      .from('outlets')
      .select('*')
      .order('name');
    
    if (fetchError) {
      console.error('Fetch outlets error:', fetchError);
    } else {
      console.log('✓ Successfully fetched outlets:', allOutlets?.length || 0, 'records');
      if (allOutlets && allOutlets.length > 0) {
        console.log('Sample outlet:', allOutlets[0]);
      }
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testOutlets();
