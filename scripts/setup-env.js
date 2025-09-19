#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🐟 Rio Fish Farm - Environment Setup');
console.log('=====================================\n');

const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envPath)) {
  console.log('✅ .env file already exists');
  console.log('📝 Please ensure it contains:');
  console.log('   VITE_SUPABASE_URL=your_supabase_project_url');
  console.log('   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key\n');
} else {
  console.log('📝 Creating .env file...');
  
  const envContent = `# Supabase Configuration
# Get these values from your Supabase project dashboard
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Example:
# VITE_SUPABASE_URL=https://your-project-id.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
`;

  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created successfully!');
  console.log('📝 Please update it with your actual Supabase credentials\n');
}

console.log('🚀 Next steps:');
console.log('1. Get your Supabase credentials from https://supabase.com/dashboard');
console.log('2. Update the .env file with your actual values');
console.log('3. Run: npm run setup-db (to set up the database)');
console.log('4. Run: npm run dev (to start the development server)');
console.log('\n📚 For more help, check the ROLE_MANAGEMENT.md file');
