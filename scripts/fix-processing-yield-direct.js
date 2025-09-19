#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from server.env
require('dotenv').config({ path: path.join(__dirname, '..', 'server', 'server.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQLStatement(statement) {
  try {
    // For CREATE FUNCTION statements, we need to use a different approach
    if (statement.toUpperCase().includes('CREATE OR REPLACE FUNCTION')) {
      // Try to execute as a raw SQL query
      const { data, error } = await supabase.rpc('exec', { sql: statement });
      if (error && !error.message.includes('function exec')) {
        throw error;
      }
      return { success: true, data, error };
    }
    
    // For other statements, try different approaches
    const { data, error } = await supabase.rpc('exec', { sql: statement });
    if (error && !error.message.includes('function exec')) {
      throw error;
    }
    
    return { success: true, data, error };
  } catch (error) {
    return { success: false, error };
  }
}

async function updateProcessingRecords() {
  console.log('🔄 Updating existing processing records with null processing_yield...');
  
  try {
    // First, let's check current state
    const { data: currentData, error: currentError } = await supabase
      .from('processing_records')
      .select('id, pre_processing_weight, post_processing_weight, processing_yield')
      .is('processing_yield', null);
    
    if (currentError) {
      console.log('⚠️  Could not check current records:', currentError.message);
      return false;
    }
    
    console.log(`📊 Found ${currentData?.length || 0} records with null processing_yield`);
    
    if (currentData && currentData.length > 0) {
      // Update each record
      for (const record of currentData) {
        if (record.pre_processing_weight && record.post_processing_weight && record.pre_processing_weight > 0) {
          const processingYield = Math.round((record.post_processing_weight / record.pre_processing_weight) * 100 * 100) / 100;
          
          const { error: updateError } = await supabase
            .from('processing_records')
            .update({ 
              processing_yield: processingYield,
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id);
          
          if (updateError) {
            console.log(`⚠️  Failed to update record ${record.id}:`, updateError.message);
          } else {
            console.log(`✅ Updated record ${record.id} with processing_yield: ${processingYield}%`);
          }
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error updating processing records:', error);
    return false;
  }
}

async function testConnection() {
  console.log('🔍 Testing database connection...');
  
  try {
    const { data, error } = await supabase
      .from('processing_records')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('⚠️  Connection test warning:', error.message);
      return false;
    } else {
      console.log('✅ Database connection successful');
      return true;
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

async function checkResults() {
  console.log('\n📊 Checking results...');
  
  try {
    const { data, error } = await supabase
      .from('processing_records')
      .select('id, pre_processing_weight, post_processing_weight, processing_yield')
      .is('processing_yield', null);
    
    if (error) {
      console.log('⚠️  Could not check results:', error.message);
    } else {
      console.log(`📈 Records with null processing_yield: ${data?.length || 0}`);
      
      if (data && data.length === 0) {
        console.log('✅ All processing records now have processing_yield values!');
      } else {
        console.log('⚠️  Some records still have null processing_yield values');
      }
    }
  } catch (error) {
    console.error('❌ Error checking results:', error);
  }
}

async function main() {
  console.log('🐟 Fish Management - Processing Yield Fix (Direct Method)\n');
  
  // Test connection first
  const connectionOk = await testConnection();
  if (!connectionOk) {
    console.log('❌ Cannot proceed without database connection');
    process.exit(1);
  }
  
  try {
    // Update existing records
    const updateSuccess = await updateProcessingRecords();
    
    if (updateSuccess) {
      console.log('\n✅ Processing yield update completed!');
    } else {
      console.log('\n⚠️  Processing yield update completed with warnings');
    }
    
    // Check results
    await checkResults();
    
    console.log('\n📋 Summary:');
    console.log('   - Updated existing processing records with calculated processing_yield values');
    console.log('   - Processing yield = (post_processing_weight / pre_processing_weight) * 100');
    console.log('   - All records should now have valid processing_yield values');
    console.log('\n💡 Note: For future records, you may need to ensure processing_yield is calculated');
    console.log('   in your application code or add a database trigger manually in Supabase dashboard.');
    
  } catch (error) {
    console.error('❌ Error running processing yield fix:', error);
    process.exit(1);
  }
}

// Run the fix
main().catch(console.error);
