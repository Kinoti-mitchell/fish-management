const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: 'server/server.env' });

// Initialize Supabase client
const supabaseUrl = 'https://pgpazwlejhysxabtkifz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fs.readFileSync('SUPABASE_SERVICE_ROLE_KEY', 'utf8').trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOutletReceivingFunction() {
  try {
    console.log('🔧 Fixing get_outlet_receiving_records function...');
    
    // Drop the existing function
    const { error: dropError } = await supabase.rpc('exec_sql', { 
      sql: 'DROP FUNCTION IF EXISTS get_outlet_receiving_records();' 
    });
    
    if (dropError) {
      console.log('⚠️  Drop warning (may not exist):', dropError.message);
    }
    
    // Create the corrected function
    const correctedFunction = `
CREATE OR REPLACE FUNCTION get_outlet_receiving_records()
RETURNS TABLE (
    id UUID,
    dispatch_id UUID,
    outlet_order_id UUID,
    received_date DATE,
    received_by UUID,
    expected_weight DECIMAL(10,2),
    actual_weight_received DECIMAL(10,2),
    expected_pieces INTEGER,
    actual_pieces_received INTEGER,
    expected_value DECIMAL(10,2),
    actual_value_received DECIMAL(10,2),
    condition condition_type,
    size_discrepancies JSONB,
    discrepancy_notes TEXT,
    status VARCHAR(20),
    outlet_name TEXT,
    outlet_location TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    dispatch_destination TEXT,
    dispatch_date DATE,
    order_number TEXT,
    outlet_name_from_order TEXT,
    outlet_location_from_order TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        outlet_rec.id,
        outlet_rec.dispatch_id,
        outlet_rec.outlet_order_id,
        outlet_rec.received_date,
        outlet_rec.received_by,
        outlet_rec.expected_weight,
        outlet_rec.actual_weight_received,
        outlet_rec.expected_pieces,
        outlet_rec.actual_pieces_received,
        outlet_rec.expected_value,
        outlet_rec.actual_value_received,
        outlet_rec.condition,
        outlet_rec.size_discrepancies,
        outlet_rec.discrepancy_notes,
        outlet_rec.status,
        outlet_rec.outlet_name,
        outlet_rec.outlet_location,
        outlet_rec.created_at,
        outlet_rec.updated_at,
        dr.destination as dispatch_destination,
        dr.dispatch_date,
        oo.order_number,
        outlet.name as outlet_name_from_order,
        outlet.location as outlet_location_from_order
    FROM outlet_receiving outlet_rec
    LEFT JOIN dispatch_records dr ON outlet_rec.dispatch_id = dr.id
    LEFT JOIN outlet_orders oo ON outlet_rec.outlet_order_id = oo.id
    LEFT JOIN outlets outlet ON oo.outlet_id = outlet.id
    ORDER BY outlet_rec.received_date DESC, outlet_rec.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;
    
    const { error: createError } = await supabase.rpc('exec_sql', { sql: correctedFunction });
    
    if (createError) {
      console.error('❌ Error creating function:', createError);
      return;
    }
    
    console.log('✅ Function created successfully!');
    
    // Test the function
    const { data, error: testError } = await supabase.rpc('get_outlet_receiving_records');
    
    if (testError) {
      console.error('❌ Test error:', testError);
    } else {
      console.log('✅ Function test successful!');
      console.log('📊 Records found:', data?.length || 0);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixOutletReceivingFunction();
