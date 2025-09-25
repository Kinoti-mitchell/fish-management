#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔑 Adding Supabase Service Role Key to .env file...\n');

const envPath = path.join(process.cwd(), '.env');
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBncGF6d2xlamh5c3hhYnRraWZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzg2MTQ4OSwiZXhwIjoyMDY5NDM3NDg5fQ.wnB6HLpF6vLuwDIWrHgZzU4PubvOqrzHxbLc3qgxIh8';

const envContent = `# Supabase Configuration
VITE_SUPABASE_URL=https://pgpazwlejhysxabtkifz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBncGF6d2xlamh5c3hhYnRraWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NjE0ODksImV4cCI6MjA2OTQzNzQ4OX0.VZjBmh5647fzGgfW8ttNMUirKRXIg1hj0X8pG0dhjD0
SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}

# Application Configuration
VITE_APP_NAME=RIO FISH FARM
VITE_APP_VERSION=1.0.0
VITE_APP_ENVIRONMENT=development

# API Configuration
VITE_API_BASE_URL=http://localhost:3000
VITE_API_TIMEOUT=10000

# Feature Flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG_MODE=true`;

try {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Service role key added to .env file successfully!');
  console.log('\n📋 Next steps:');
  console.log('1. Run "npm run setup-db" to set up the database');
  console.log('2. Run "npm run setup-users" to create initial users');
  console.log('3. The app should now work properly!');
} catch (error) {
  console.error('❌ Error writing to .env file:', error.message);
  console.log('\n🔧 Manual fix:');
  console.log('Add this line to your .env file:');
  console.log(`SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`);
}
