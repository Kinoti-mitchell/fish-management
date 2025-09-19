// Create Supabase Auth user for a profile
require('dotenv').config({ path: './server/server.env' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAuthUser(email, password, firstName, lastName, role, phone) {
  try {
    console.log(`🔧 Creating auth user for ${email}...`);
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role: role,
        phone: phone || null,
      }
    });
    
    if (authError) {
      console.error(`❌ Failed to create auth user: ${authError.message}`);
      return false;
    }
    
    console.log(`✅ Created auth user for ${email}`);
    console.log(`   Auth ID: ${authData.user.id}`);
    console.log(`   Role: ${role}`);
    console.log(`   Password: ${password}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 5) {
  console.log('Usage: node create-auth-user.js <email> <password> <firstName> <lastName> <role> [phone]');
  console.log('Example: node create-auth-user.js john@example.com password123 John Doe admin +1234567890');
  process.exit(1);
}

const [email, password, firstName, lastName, role, phone] = args;

createAuthUser(email, password, firstName, lastName, role, phone);
