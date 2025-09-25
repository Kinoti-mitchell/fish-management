# Disable Git pager to prevent terminal from getting stuck
git config --global core.pager ""
git config --global pager.branch false
git config --global pager.log false
git config --global pager.status false
git config --global pager.diff false
git config --global pager.show false

Write-Host "Git pager disabled successfully!"
Write-Host "You can now use Git commands without getting stuck in pager view."
