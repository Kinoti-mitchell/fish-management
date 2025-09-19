@echo off
echo Starting deployment process...

REM Set git pager to empty
git config --global core.pager ""

REM Switch to main branch
echo Switching to main branch...
git checkout main

REM Add all changes
echo Adding all changes...
git add .

REM Commit changes
echo Committing changes...
git commit -m "Clean up repository: remove duplicate files and build artifacts"

REM Build the project
echo Building project...
set NODE_ENV=production
npm run build

REM Deploy to GitHub Pages
echo Deploying to GitHub Pages...
npm run deploy

echo Deployment complete!
echo.
echo Please check: https://kinoti-mitchell.github.io/fish-management/
pause
