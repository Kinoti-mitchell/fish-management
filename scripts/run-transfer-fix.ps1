# PowerShell script to help run the transfer fix
# This script provides instructions for running the SQL fix in Supabase

Write-Host "Fish Management - Transfer Fix" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green
Write-Host ""

Write-Host "The transfer functions need to be created in your Supabase database." -ForegroundColor Yellow
Write-Host ""

Write-Host "To fix the transfer issue, you need to run the SQL script in your Supabase dashboard:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Go to your Supabase project dashboard:" -ForegroundColor White
Write-Host "   https://supabase.com/dashboard/project/pgpazwlejhysxabtkifz" -ForegroundColor Blue
Write-Host ""
Write-Host "2. Navigate to SQL Editor" -ForegroundColor White
Write-Host ""
Write-Host "3. Copy and paste the contents of: db/FIX_TRANSFER_WORKING.sql" -ForegroundColor White
Write-Host ""
Write-Host "4. Execute the script" -ForegroundColor White
Write-Host ""

# Check if the SQL file exists
$sqlFile = "db/FIX_TRANSFER_WORKING.sql"
if (Test-Path $sqlFile) {
    Write-Host "SQL fix file found: $sqlFile" -ForegroundColor Green
    
    # Show the first few lines of the SQL file
    Write-Host ""
    Write-Host "Preview of the SQL script:" -ForegroundColor Cyan
    Write-Host "=========================" -ForegroundColor Cyan
    Get-Content $sqlFile -Head 15 | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
    Write-Host "..." -ForegroundColor Gray
    Write-Host ""
    
    # Ask if user wants to open the file
    $openFile = Read-Host "Would you like to open the SQL file? (y/n)"
    if ($openFile -eq "y" -or $openFile -eq "Y") {
        Start-Process notepad.exe -ArgumentList $sqlFile
    }
} else {
    Write-Host "SQL fix file not found: $sqlFile" -ForegroundColor Red
}

Write-Host ""
Write-Host "After running the SQL script, the transfer system will work properly." -ForegroundColor Green
Write-Host "The script will:" -ForegroundColor White
Write-Host "- Create transfer_inventory_between_storage function" -ForegroundColor White
Write-Host "- Create transfer_requests table" -ForegroundColor White
Write-Host "- Create create_transfer_request function" -ForegroundColor White
Write-Host "- Create approve_transfer_request function" -ForegroundColor White
Write-Host "- Create decline_transfer_request function" -ForegroundColor White
Write-Host "- Grant proper permissions" -ForegroundColor White
Write-Host ""

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
