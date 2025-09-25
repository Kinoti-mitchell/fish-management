# PowerShell script to deploy the GitHub Actions workflow
# This bypasses the git mmap issues by using a minimal git operation

Write-Host "Setting up GitHub Actions deployment workflow..." -ForegroundColor Green

# Set git configuration to avoid mmap issues
$env:GIT_PAGER = ""
git config --global core.pager ""
git config --global core.preloadindex false
git config --global core.fscache false

Write-Host "Adding workflow files..." -ForegroundColor Yellow
git add .github/

Write-Host "Committing workflow..." -ForegroundColor Yellow
git commit -m "Add GitHub Actions deployment workflow"

Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push origin main

Write-Host "Deployment workflow setup complete!" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Go to your GitHub repository settings" -ForegroundColor White
Write-Host "2. Navigate to Pages section" -ForegroundColor White
Write-Host "3. Set source to 'GitHub Actions'" -ForegroundColor White
Write-Host "4. The workflow will automatically deploy on the next push to main" -ForegroundColor White
