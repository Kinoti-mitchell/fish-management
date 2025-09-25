#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🐟 Setting up RioFish Frontend Environment...\n');

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env');

if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file...');
  
  const envContent = `# Supabase Configuration
VITE_SUPABASE_URL=https://pgpazwlejhysxabtkifz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBncGF6d2xlamh5c3hhYnRraWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NjE0ODksImV4cCI6MjA2OTQzNzQ4OX0.VZjBmh5647fzGgfW8ttNMUirKRXIg1hj0X8pG0dhjD0

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

  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created successfully!');
} else {
  console.log('✅ .env file already exists');
}

console.log('\n🎉 Frontend setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('1. Run "npm install" to install dependencies');
console.log('2. Run "npm run dev" to start the development server');
console.log('\n🔗 The app will be available at http://localhost:5173');
