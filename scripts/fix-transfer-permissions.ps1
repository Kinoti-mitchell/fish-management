# PowerShell script to fix transfer table permissions
# This script provides instructions for running the RLS fix in Supabase

Write-Host "Fish Management - Transfer Permissions Fix" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

Write-Host "This will fix the 'permission denied for table transfer_requests' error." -ForegroundColor Yellow
Write-Host ""

Write-Host "To fix the transfer permissions, you need to run the SQL script in your Supabase dashboard:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Go to your Supabase project dashboard:" -ForegroundColor White
Write-Host "   https://supabase.com/dashboard/project/pgpazwlejhysxabtkifz" -ForegroundColor Blue
Write-Host ""
Write-Host "2. Navigate to SQL Editor" -ForegroundColor White
Write-Host ""
Write-Host "3. Copy and paste the contents of: db/DISABLE_RLS_TRANSFER_TABLES.sql" -ForegroundColor White
Write-Host ""
Write-Host "4. Execute the script" -ForegroundColor White
Write-Host ""

# Check if the SQL file exists
$sqlFile = "db/DISABLE_RLS_TRANSFER_TABLES.sql"
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
Write-Host "After running the SQL script, the transfer system will work without permission errors." -ForegroundColor Green
Write-Host "The script will:" -ForegroundColor White
Write-Host "- Disable RLS on transfer_requests table" -ForegroundColor White
Write-Host "- Disable RLS on transfer_log table" -ForegroundColor White
Write-Host "- Grant all permissions to authenticated users" -ForegroundColor White
Write-Host "- Grant all permissions to anon users" -ForegroundColor White
Write-Host "- Create tables if they don't exist" -ForegroundColor White
Write-Host ""

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
