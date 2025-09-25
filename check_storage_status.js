const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read the service role key
const serviceKey = fs.readFileSync('SUPABASE_SERVICE_ROLE_KEY', 'utf8').trim();
const supabaseUrl = 'https://pgpazwlejhysxabtkifz.supabase.co';

const supabase = createClient(supabaseUrl, serviceKey);

async function checkStorageStatus() {
  try {
    console.log('🔍 Checking storage locations status...');
    
    const { data, error } = await supabase
      .from('storage_locations')
      .select('id, name, status, location_type, capacity_kg')
      .order('name');
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log('📊 All storage locations:');
    data.forEach(storage => {
      console.log(`- ${storage.name}: ${storage.status} (${storage.location_type})`);
    });
    
    // Check specifically for Cold Storage A
    const coldStorageA = data.find(s => s.name.toLowerCase().includes('cold storage a'));
    if (coldStorageA) {
      console.log('\n🧊 Cold Storage A details:');
      console.log(JSON.stringify(coldStorageA, null, 2));
    } else {
      console.log('\n❌ Cold Storage A not found');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkStorageStatus();
