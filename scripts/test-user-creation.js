// Test user creation functionality
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUserCreation() {
  console.log('🧪 Testing user creation...');
  
  try {
    // Test 1: Check if tables exist
    console.log('\n1. Checking if required tables exist...');
    
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['profiles', 'user_roles', 'user_sessions', 'system_config']);
    
    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError);
    } else {
      console.log('✅ Tables found:', tables?.map(t => t.table_name) || []);
    }

    // Test 2: Check if user roles exist
    console.log('\n2. Checking user roles...');
    
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('name, display_name, is_active')
      .eq('is_active', true);
    
    if (rolesError) {
      console.error('❌ Error checking roles:', rolesError);
    } else {
      console.log('✅ User roles found:', roles?.length || 0);
      roles?.forEach(role => {
        console.log(`   - ${role.name}: ${role.display_name}`);
      });
    }

    // Test 3: Check if profiles exist
    console.log('\n3. Checking user profiles...');
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, is_active')
      .eq('is_active', true);
    
    if (profilesError) {
      console.error('❌ Error checking profiles:', profilesError);
    } else {
      console.log('✅ User profiles found:', profiles?.length || 0);
      profiles?.forEach(profile => {
        console.log(`   - ${profile.email}: ${profile.first_name} ${profile.last_name} (${profile.role})`);
      });
    }

    // Test 4: Test user session creation
    console.log('\n4. Testing user session creation...');
    
    const testUserId = '1a31181e-9b3d-4928-8349-f5b38466e5fb';
    const testSessionToken = 'test-session-token-' + Date.now();
    
    const { data: sessionData, error: sessionError } = await supabase
      .from('user_sessions')
      .insert([{
        user_id: testUserId,
        session_token: testSessionToken,
        is_active: true,
        last_activity: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString()
      }])
      .select();
    
    if (sessionError) {
      console.error('❌ Error creating user session:', sessionError);
    } else {
      console.log('✅ User session created successfully');
      
      // Clean up test session
      await supabase
        .from('user_sessions')
        .delete()
        .eq('session_token', testSessionToken);
      console.log('✅ Test session cleaned up');
    }

    console.log('\n🎉 Database test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testUserCreation();
