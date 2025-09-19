$env:GIT_PAGER = ""
git config --global core.pager ""
git checkout main
git add .
git commit -m "Deploy to main branch"
git push origin main
