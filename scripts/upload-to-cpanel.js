#!/usr/bin/env node

/**
 * Fish Management PWA - cPanel Upload Script
 * 
 * This script helps upload your built application to cPanel hosting
 * using FTP/SFTP connection.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Check if required dependencies are available
let ftp, sftp;
try {
  ftp = require('basic-ftp');
} catch (e) {
  console.log('Installing basic-ftp...');
  require('child_process').execSync('npm install basic-ftp', { stdio: 'inherit' });
  ftp = require('basic-ftp');
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function uploadToFTP() {
  console.log('🐟 Fish Management PWA - cPanel Upload Script\n');
  
  try {
    // Get FTP credentials
    const host = await question('FTP Host (e.g., ftp.yourdomain.com): ');
    const username = await question('FTP Username: ');
    const password = await question('FTP Password: ');
    const remotePath = await question('Remote path (e.g., /public_html or /public_html/subdomain): ') || '/public_html';
    const useSSL = (await question('Use SSL/TLS? (y/n): ')).toLowerCase() === 'y';
    
    console.log('\n📁 Checking build directory...');
    
    // Check if build directory exists
    const buildDir = path.join(__dirname, '..', 'build');
    if (!fs.existsSync(buildDir)) {
      console.error('❌ Build directory not found! Please run "npm run build" first.');
      process.exit(1);
    }
    
    // Check if .htaccess exists
    const htaccessPath = path.join(__dirname, '..', '.htaccess');
    if (!fs.existsSync(htaccessPath)) {
      console.error('❌ .htaccess file not found! Please ensure it exists in the project root.');
      process.exit(1);
    }
    
    console.log('✅ Build directory and .htaccess found');
    
    // Create FTP client
    const client = new ftp.Client();
    client.ftp.verbose = true;
    
    console.log('\n🔌 Connecting to FTP server...');
    
    // Connect to FTP server
    await client.access({
      host: host,
      user: username,
      password: password,
      secure: useSSL
    });
    
    console.log('✅ Connected successfully!');
    
    // Change to remote directory
    console.log(`\n📂 Changing to remote directory: ${remotePath}`);
    await client.ensureDir(remotePath);
    await client.cd(remotePath);
    
    // Upload .htaccess first
    console.log('\n📄 Uploading .htaccess...');
    await client.uploadFrom(htaccessPath, '.htaccess');
    console.log('✅ .htaccess uploaded');
    
    // Upload index.html
    console.log('\n📄 Uploading index.html...');
    const indexPath = path.join(buildDir, 'index.html');
    await client.uploadFrom(indexPath, 'index.html');
    console.log('✅ index.html uploaded');
    
    // Upload favicon files from public directory
    console.log('\n🎨 Uploading favicon files...');
    const publicDir = path.join(__dirname, '..', 'public');
    if (fs.existsSync(publicDir)) {
      const faviconIco = path.join(publicDir, 'favicon.ico');
      const faviconSvg = path.join(publicDir, 'favicon.svg');
      
      if (fs.existsSync(faviconIco)) {
        await client.uploadFrom(faviconIco, 'favicon.ico');
        console.log('✅ favicon.ico uploaded');
      }
      
      if (fs.existsSync(faviconSvg)) {
        await client.uploadFrom(faviconSvg, 'favicon.svg');
        console.log('✅ favicon.svg uploaded');
      }
    }
    
    // Upload assets directory
    console.log('\n📦 Uploading assets directory...');
    const assetsDir = path.join(buildDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      await client.uploadFromDir(assetsDir, 'assets');
      console.log('✅ Assets directory uploaded');
    } else {
      console.log('⚠️  Assets directory not found in build folder');
    }
    
    // List uploaded files
    console.log('\n📋 Verifying upload...');
    const list = await client.list();
    console.log('Uploaded files:');
    list.forEach(file => {
      console.log(`  - ${file.name} (${file.size} bytes)`);
    });
    
    console.log('\n🎉 Upload completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Visit your website to test the deployment');
    console.log('2. Check browser console for any errors');
    console.log('3. Test all major functionality');
    console.log('4. Verify Supabase connection is working');
    
  } catch (error) {
    console.error('\n❌ Upload failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('- Verify your FTP credentials are correct');
    console.log('- Check that your hosting provider allows FTP connections');
    console.log('- Ensure the remote path exists and you have write permissions');
    console.log('- Try using SSL/TLS if the connection fails');
  } finally {
    rl.close();
  }
}

// Alternative: Manual upload instructions
function showManualInstructions() {
  console.log('\n📋 Manual Upload Instructions:\n');
  console.log('1. Access your cPanel File Manager');
  console.log('2. Navigate to your domain\'s public_html directory');
  console.log('3. Upload these files:');
  console.log('   - .htaccess (from project root)');
  console.log('   - index.html (from build/ folder)');
  console.log('   - favicon.ico and favicon.svg (from public/ folder)');
  console.log('   - assets/ folder (entire folder from build/)');
  console.log('\n4. Set file permissions:');
  console.log('   - Files: 644');
  console.log('   - Directories: 755');
  console.log('\n5. Test your website!');
}

// Main execution
async function main() {
  const choice = await question('Choose upload method:\n1. FTP Upload (automated)\n2. Manual Instructions\nEnter choice (1 or 2): ');
  
  if (choice === '1') {
    await uploadToFTP();
  } else if (choice === '2') {
    showManualInstructions();
  } else {
    console.log('Invalid choice. Exiting...');
  }
  
  rl.close();
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n\n👋 Upload cancelled by user');
  rl.close();
  process.exit(0);
});

// Run the script
main().catch(error => {
  console.error('Script error:', error);
  rl.close();
  process.exit(1);
});
