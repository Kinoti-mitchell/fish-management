# Remove git pager completely
git config --global --unset core.pager
git config --global --unset pager.branch
git config --global --unset pager.log
git config --global --unset pager.diff
git config --global --unset pager.show
git config --global --unset pager.status

# Set pager to empty string as backup
git config --global core.pager ""

# Verify the configuration
Write-Host "Git pager configuration:"
git config --global --get core.pager
