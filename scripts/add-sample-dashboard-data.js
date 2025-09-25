// Script to add sample data for dashboard testing
// This will add warehouse entries with temperature data

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Load environment variables from server.env
const fs = require('fs');
const path = require('path');

// Read server.env file
const envPath = path.join(__dirname, '..', 'server', 'server.env');
const envContent = fs.readFileSync(envPath, 'utf8');

// Parse environment variables
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Could not load Supabase credentials from server.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addSampleData() {
  try {
    console.log('🔄 Adding sample warehouse entries with temperature data...');

    // First, let's check if we have any farmers
    const { data: farmers, error: farmerError } = await supabase
      .from('farmers')
      .select('id')
      .limit(1);

    if (farmerError) {
      console.error('❌ Error fetching farmers:', farmerError);
      return;
    }

    if (!farmers || farmers.length === 0) {
      console.log('⚠️  No farmers found. Creating a sample farmer first...');
      
      // Create a sample farmer
      const { data: newFarmer, error: createFarmerError } = await supabase
        .from('farmers')
        .insert({
          name: 'Sample Farmer',
          contact_info: 'sample@example.com',
          location: 'Sample Location'
        })
        .select('id')
        .single();

      if (createFarmerError) {
        console.error('❌ Error creating farmer:', createFarmerError);
        return;
      }

      farmers.push(newFarmer);
    }

    const farmerId = farmers[0].id;

    // Sample warehouse entries with temperature data
    const sampleEntries = [
      {
        entry_date: new Date().toISOString().split('T')[0],
        total_weight: 25.5,
        total_pieces: 85,
        fish_type: 'Nile Tilapia',
        condition: 'excellent',
        temperature: 23.5,
        farmer_id: farmerId,
        price_per_kg: 16.0,
        total_value: 408.0,
        notes: 'Fresh tilapia with optimal temperature'
      },
      {
        entry_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Yesterday
        total_weight: 40.0,
        total_pieces: 25,
        fish_type: 'Nile Perch',
        condition: 'good',
        temperature: 19.5,
        farmer_id: farmerId,
        price_per_kg: 26.0,
        total_value: 1040.0,
        notes: 'Large perch batch - cool storage'
      },
      {
        entry_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days ago
        total_weight: 20.0,
        total_pieces: 80,
        fish_type: 'Silver Cyprinid',
        condition: 'excellent',
        temperature: 25.0,
        farmer_id: farmerId,
        price_per_kg: 13.0,
        total_value: 260.0,
        notes: 'Small fish - warm water species'
      },
      {
        entry_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days ago
        total_weight: 35.0,
        total_pieces: 45,
        fish_type: 'Nile Tilapia',
        condition: 'good',
        temperature: 21.0,
        farmer_id: farmerId,
        price_per_kg: 15.5,
        total_value: 542.5,
        notes: 'Medium tilapia batch'
      },
      {
        entry_date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 days ago
        total_weight: 50.0,
        total_pieces: 20,
        fish_type: 'Nile Perch',
        condition: 'excellent',
        temperature: 18.5,
        farmer_id: farmerId,
        price_per_kg: 28.0,
        total_value: 1400.0,
        notes: 'Premium perch - optimal temperature'
      }
    ];

    // Insert the sample entries
    const { data: insertedEntries, error: insertError } = await supabase
      .from('warehouse_entries')
      .insert(sampleEntries)
      .select('id, entry_date, fish_type, temperature, total_weight');

    if (insertError) {
      console.error('❌ Error inserting sample data:', insertError);
      return;
    }

    console.log('✅ Successfully added sample data:');
    console.log(`   - ${insertedEntries.length} warehouse entries added`);
    console.log(`   - Temperature range: ${Math.min(...insertedEntries.map(e => e.temperature))}°C to ${Math.max(...insertedEntries.map(e => e.temperature))}°C`);
    console.log(`   - Total weight: ${insertedEntries.reduce((sum, e) => sum + e.total_weight, 0)}kg`);

    // Verify the data
    const { data: allEntries, error: verifyError } = await supabase
      .from('warehouse_entries')
      .select('temperature, total_weight, total_pieces')
      .not('temperature', 'is', null);

    if (verifyError) {
      console.error('❌ Error verifying data:', verifyError);
      return;
    }

    if (allEntries && allEntries.length > 0) {
      const avgTemp = allEntries.reduce((sum, e) => sum + e.temperature, 0) / allEntries.length;
      const totalWeight = allEntries.reduce((sum, e) => sum + e.total_weight, 0);
      const totalPieces = allEntries.reduce((sum, e) => sum + e.total_pieces, 0);
      const avgFishSize = totalPieces > 0 ? totalWeight / totalPieces : 0;

      console.log('\n📊 Dashboard data summary:');
      console.log(`   - Average temperature: ${avgTemp.toFixed(1)}°C`);
      console.log(`   - Average fish size: ${avgFishSize.toFixed(2)}kg`);
      console.log(`   - Total entries with temperature: ${allEntries.length}`);
    }

    console.log('\n🎉 Sample data added successfully! Refresh your dashboard to see the changes.');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
addSampleData();
