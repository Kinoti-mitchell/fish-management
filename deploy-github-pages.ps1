# GitHub Pages Deployment Script
# This script builds the project and deploys it to GitHub Pages

# First, revert index.html to development state for building
Write-Host "Preparing for build..." -ForegroundColor Green
$indexContent = @"
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
    <title>Rio Fish Farm - Kenya Operations</title>
    
    <!-- PWA Meta Tags -->
    <meta name="theme-color" content="#1e40af" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Rio Fish" />
    <meta name="msapplication-TileColor" content="#1e40af" />
    
    <!-- Icons -->
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <link rel="alternate icon" href="./favicon.ico" />
    <link rel="apple-touch-icon" href="./rio-fish-logo.png" />
    
    <!-- Preconnect to external domains for performance -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

    <!-- Vite will inject the correct asset paths during build -->
  </head>

  <body>
    <div id="root"></div>
  </body>
</html>
"@

$indexContent | Out-File -FilePath "index.html" -Encoding UTF8

Write-Host "Building the project..." -ForegroundColor Green
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Copying built files to root directory..." -ForegroundColor Green
Copy-Item -Path "build\*" -Destination "." -Recurse -Force

Write-Host "Committing and pushing to GitHub..." -ForegroundColor Green
$env:GIT_PAGER = ""
git config --global core.pager ""

git add .
git commit -m "Deploy improved audit logs with warehouse entry descriptions and sorting fixes - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git push origin main

Write-Host "Deployment completed!" -ForegroundColor Green
Write-Host "Your site should be available at: https://kinoti-mitchell.github.io/fish-management" -ForegroundColor Cyan
