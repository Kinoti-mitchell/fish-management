// Script to check dispatch records status issue
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from server.env
const envPath = path.join(__dirname, '..', 'server', 'server.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDispatchStatus() {
  try {
    console.log('🔍 Checking dispatch records status...\n');

    // Get all dispatch records with detailed info
    const { data: dispatchRecords, error: drError } = await supabase
      .from('dispatch_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (drError) {
      console.error('❌ Error fetching dispatch records:', drError);
      return;
    }

    console.log(`Total dispatch records: ${dispatchRecords?.length || 0}\n`);

    if (dispatchRecords && dispatchRecords.length > 0) {
      dispatchRecords.forEach((record, i) => {
        console.log(`Dispatch Record ${i + 1}:`);
        console.log(`  ID: ${record.id}`);
        console.log(`  Status: "${record.status}" (type: ${typeof record.status})`);
        console.log(`  Destination: ${record.destination || 'N/A'}`);
        console.log(`  Total Weight: ${record.total_weight || 'N/A'}`);
        console.log(`  Created: ${record.created_at || 'N/A'}`);
        console.log(`  Updated: ${record.updated_at || 'N/A'}`);
        console.log('  All fields:', JSON.stringify(record, null, 2));
        console.log('---');
      });

      // Check what status values exist
      const statusValues = [...new Set(dispatchRecords.map(r => r.status))];
      console.log(`\nUnique status values found: ${JSON.stringify(statusValues)}`);

      // Check for null/undefined statuses
      const nullStatuses = dispatchRecords.filter(r => r.status === null || r.status === undefined || r.status === '');
      console.log(`Records with null/undefined/empty status: ${nullStatuses.length}`);

    } else {
      console.log('No dispatch records found.');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
checkDispatchStatus();
