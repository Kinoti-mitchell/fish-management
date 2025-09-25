#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Copy development environment file to .env for local development
const sourceFile = path.join(__dirname, 'env.development');
const targetFile = path.join(__dirname, '.env');

try {
  if (fs.existsSync(sourceFile)) {
    fs.copyFileSync(sourceFile, targetFile);
    console.log('✅ Environment file created successfully!');
    console.log('📁 Source:', sourceFile);
    console.log('📁 Target:', targetFile);
  } else {
    console.error('❌ Source environment file not found:', sourceFile);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error creating environment file:', error.message);
  process.exit(1);
}
