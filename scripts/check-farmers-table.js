#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkFarmersTable() {
  console.log('🔍 Checking farmers table...\n');
  
  try {
    // Check if farmers table exists
    const { data, error } = await supabase
      .from('farmers')
      .select('count')
      .limit(1);
    
    if (error) {
      if (error.code === 'PGRST116') {
        console.log('❌ Farmers table does not exist');
        console.log('📋 You need to run the database migrations to create the farmers table');
        console.log('📝 Run this SQL in Supabase SQL Editor:');
        console.log(`
CREATE TABLE IF NOT EXISTS farmers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    location VARCHAR(200) NOT NULL,
    rating DECIMAL(3,2) DEFAULT 0.0,
    reliability VARCHAR(20) DEFAULT 'fair',
    status VARCHAR(20) DEFAULT 'active',
    average_fish_size DECIMAL(4,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample farmers
INSERT INTO farmers (name, phone, location, rating, reliability, status) VALUES
('John Mwangi', '+254700000001', 'Kisumu', 4.5, 'excellent', 'active'),
('Mary Wanjiku', '+254700000002', 'Mombasa', 4.2, 'good', 'active'),
('Peter Otieno', '+254700000003', 'Nakuru', 3.8, 'fair', 'active'),
('Grace Akinyi', '+254700000004', 'Eldoret', 4.0, 'good', 'active'),
('David Kimani', '+254700000005', 'Nairobi', 4.3, 'excellent', 'active')
ON CONFLICT DO NOTHING;

-- Disable RLS for testing
ALTER TABLE farmers DISABLE ROW LEVEL SECURITY;
        `);
        return;
      } else {
        console.log(`❌ Error checking farmers table: ${error.message}`);
        return;
      }
    }
    
    console.log('✅ Farmers table exists');
    
    // Check if there are any farmers
    const { data: farmers, error: farmersError } = await supabase
      .from('farmers')
      .select('name, location, rating, reliability, status')
      .limit(5);
    
    if (farmersError) {
      console.log(`❌ Error fetching farmers: ${farmersError.message}`);
    } else {
      console.log(`📊 Found ${farmers.length} farmers:`);
      farmers.forEach(farmer => {
        console.log(`   - ${farmer.name} (${farmer.location}) - Rating: ${farmer.rating} - ${farmer.status}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkFarmersTable();
