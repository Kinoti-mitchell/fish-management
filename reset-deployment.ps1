# Reset GitHub Pages Deployment Script

Write-Host "Step 1: Switching to main branch..."
git checkout main

Write-Host "Step 2: Deleting local gh-pages branch..."
git branch -D gh-pages

Write-Host "Step 3: Deleting remote gh-pages branch..."
git push origin --delete gh-pages

Write-Host "Step 4: Creating fresh build..."
$env:NODE_ENV = "production"
npm run build

Write-Host "Step 5: Creating new orphan branch..."
git checkout --orphan gh-pages

Write-Host "Step 6: Adding build files..."
git add build/

Write-Host "Step 7: Committing clean build..."
git commit -m "Fresh deployment - clean build"

Write-Host "Step 8: Pushing new branch..."
git push origin gh-pages

Write-Host "Step 9: Switching back to main..."
git checkout main

Write-Host "Deployment reset complete!"
