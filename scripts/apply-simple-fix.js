#!/usr/bin/env node

/**
 * Apply Simple Outlet Receiving Fix
 * This script applies the simple SQL fix using direct table access
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './server/server.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applySimpleFix() {
  console.log('🚀 Applying simple outlet receiving fix...\n');
  
  try {
    // Read the simple SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'simple_outlet_receiving_fix.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 SQL Content to apply:');
    console.log('='.repeat(80));
    console.log(sqlContent);
    console.log('='.repeat(80));
    
    console.log('\n📋 This SQL will:');
    console.log('   ✅ Drop problematic functions');
    console.log('   ✅ Disable RLS on outlet_receiving table');
    console.log('   ✅ Grant simple permissions on tables');
    console.log('   ✅ Enable direct table access');
    
    console.log('\n⚠️  IMPORTANT: You need to apply this SQL manually in Supabase SQL Editor');
    console.log('📋 Steps:');
    console.log('1. Open your Supabase project dashboard');
    console.log('2. Go to SQL Editor (left sidebar)');
    console.log('3. Copy and paste the SQL above');
    console.log('4. Click "Run" to execute');
    console.log('5. Your application will then use direct table access');
    
    console.log('\n🎉 After applying the SQL:');
    console.log('   • Your outlet receiving functionality will work');
    console.log('   • No more function uniqueness errors');
    console.log('   • Simple, reliable table access');
    console.log('   • Your existing data is preserved');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

applySimpleFix();
