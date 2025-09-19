#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/server.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

// Use service role key to create user
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createMitchellUser() {
  console.log('🔧 Creating Mitchell user...\n');
  
  try {
    // Import bcrypt for password hashing
    const bcrypt = require('bcryptjs');
    
    // Generate a unique user ID
    const userId = '1a31181e-9b3d-4928-8349-f5b38466e5fb';
    
    // Hash the password
    const passwordHash = await bcrypt.hash('admin123', 10);
    
    console.log('👤 Creating profile in database...');
    
    // Create/update profile in the profiles table with password hash
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: 'mitchellkinoti@gmail.com',
        first_name: 'Mitchell',
        last_name: 'Kinoti',
        role: 'admin',
        phone: '',
        is_active: true,
        password_hash: passwordHash,
        last_login: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' });

    if (profileError) {
      console.log('⚠️  Profile error:', profileError.message);
      
      // If there's a foreign key constraint error, try to delete and recreate
      if (profileError.message.includes('foreign key constraint')) {
        console.log('🔄 Attempting to clean up and recreate profile...');
        
        // First, try to delete any existing profile
        await supabase
          .from('profiles')
          .delete()
          .eq('email', 'mitchellkinoti@gmail.com');
        
        // Then create the profile again
        const { error: retryError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: 'mitchellkinoti@gmail.com',
            first_name: 'Mitchell',
            last_name: 'Kinoti',
            role: 'admin',
            phone: '',
            is_active: true,
            password_hash: passwordHash,
            last_login: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (retryError) {
          console.log('❌ Still failed after retry:', retryError.message);
        } else {
          console.log('✅ Profile created successfully after cleanup');
        }
      }
    } else {
      console.log('✅ Profile created/updated successfully');
    }

    console.log('\n🎉 Setup completed!');
    console.log('You can now log in with:');
    console.log('- Email: mitchellkinoti@gmail.com');
    console.log('- Password: admin123');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📋 Manual fix required:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to Table Editor > profiles');
    console.log('3. Create a new row with:');
    console.log('   - id: 1a31181e-9b3d-4928-8349-f5b38466e5fb');
    console.log('   - email: mitchellkinoti@gmail.com');
    console.log('   - first_name: Mitchell');
    console.log('   - last_name: Kinoti');
    console.log('   - role: admin');
    console.log('   - is_active: true');
    console.log('   - password_hash: (hash of "admin123")');
  }
}

createMitchellUser();
