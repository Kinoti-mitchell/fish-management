const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pgpazwlejhysxabtkifz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fs.readFileSync(path.join(__dirname, '../SUPABASE_SERVICE_ROLE_KEY'), 'utf8').trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupOutletPermissions() {
  try {
    console.log('🔧 Setting up outlet receiving permissions...');
    
    // Test if we can access the tables directly
    console.log('🧪 Testing table access...');
    
    // Test outlet_receiving table
    const { data: receivingData, error: receivingError } = await supabase
      .from('outlet_receiving')
      .select('*')
      .limit(1);
    
    if (receivingError) {
      console.error('❌ Cannot access outlet_receiving:', receivingError.message);
    } else {
      console.log('✅ outlet_receiving table accessible');
    }
    
    // Test dispatch_records table
    const { data: dispatchData, error: dispatchError } = await supabase
      .from('dispatch_records')
      .select('*')
      .limit(1);
    
    if (dispatchError) {
      console.error('❌ Cannot access dispatch_records:', dispatchError.message);
    } else {
      console.log('✅ dispatch_records table accessible');
    }
    
    // Test outlet_orders table
    const { data: ordersData, error: ordersError } = await supabase
      .from('outlet_orders')
      .select('*')
      .limit(1);
    
    if (ordersError) {
      console.error('❌ Cannot access outlet_orders:', ordersError.message);
    } else {
      console.log('✅ outlet_orders table accessible');
    }
    
    // Test outlets table
    const { data: outletsData, error: outletsError } = await supabase
      .from('outlets')
      .select('*')
      .limit(1);
    
    if (outletsError) {
      console.error('❌ Cannot access outlets:', outletsError.message);
    } else {
      console.log('✅ outlets table accessible');
    }
    
    console.log('🎉 Permission check completed!');
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

setupOutletPermissions();
