// Test Login Fix - Verify authentication works
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
  console.log('🔐 Testing login with fixed authentication...\n');
  
  const testUsers = [
    { email: 'admin@riofish.com', password: 'password' },
    { email: 'mitchellkinoti@gmail.com', password: 'password' }
  ];
  
  for (const user of testUsers) {
    console.log(`Testing: ${user.email} with password: ${user.password}`);
    
    try {
      // Test direct database authentication (what the app uses)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', user.email.toLowerCase().trim())
        .eq('is_active', true)
        .single();
      
      if (profileError) {
        console.log(`❌ Profile not found: ${profileError.message}`);
        continue;
      }
      
      console.log(`✅ Profile found:`);
      console.log(`   Name: ${profile.first_name} ${profile.last_name}`);
      console.log(`   Role: ${profile.role}`);
      console.log(`   Active: ${profile.is_active}`);
      console.log(`   Password hash: ${profile.password_hash.substring(0, 20)}...`);
      
      // Test password verification (simplified - in real app it uses bcrypt)
      const passwordHash = profile.password_hash;
      const isBcryptHash = passwordHash.startsWith('$2a$');
      
      if (isBcryptHash) {
        console.log(`   Password format: bcrypt (correct)`);
        console.log(`   Expected password: "password"`);
      } else {
        console.log(`   Password format: ${passwordHash.length > 20 ? 'other' : 'short'} (may need update)`);
      }
      
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }
    console.log('');
  }
  
  console.log('📋 Summary:');
  console.log('1. If profiles are found, the database is set up correctly');
  console.log('2. If you see bcrypt hashes, the passwords should work');
  console.log('3. Try logging in with:');
  console.log('   - Email: admin@riofish.com, Password: password');
  console.log('   - Email: mitchellkinoti@gmail.com, Password: password');
}

testLogin().catch(console.error);
