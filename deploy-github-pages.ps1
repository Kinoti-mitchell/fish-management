# GitHub Pages Deployment Script
# This script builds the project and deploys it to GitHub Pages

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
git commit -m "Deploy to GitHub Pages - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git push origin main

Write-Host "Deployment completed!" -ForegroundColor Green
Write-Host "Your site should be available at: https://kinoti-mitchell.github.io/fish-management" -ForegroundColor Cyan
