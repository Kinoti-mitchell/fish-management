# PowerShell script to help fix disposal issues
# This script provides instructions and can help run the SQL fix

Write-Host "Fish Management - Disposal Issues Fix" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

Write-Host "The following errors have been identified:" -ForegroundColor Yellow
Write-Host "1. Permission denied for disposal_records table" -ForegroundColor Red
Write-Host "2. Permission denied for disposal_reasons table" -ForegroundColor Red
Write-Host "3. Missing get_inventory_for_disposal RPC function" -ForegroundColor Red
Write-Host "4. Missing create_auto_disposal RPC function" -ForegroundColor Red
Write-Host ""

Write-Host "To fix these issues, you need to run the SQL script in your Supabase dashboard:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Go to your Supabase project dashboard:" -ForegroundColor White
Write-Host "   https://supabase.com/dashboard/project/pgpazwlejhysxabtkifz" -ForegroundColor Blue
Write-Host ""
Write-Host "2. Navigate to SQL Editor" -ForegroundColor White
Write-Host ""
Write-Host "3. Copy and paste the contents of: db/FIX_DISPOSAL_ISSUES_COMPLETE.sql" -ForegroundColor White
Write-Host ""
Write-Host "4. Execute the script" -ForegroundColor White
Write-Host ""

# Check if the SQL file exists
$sqlFile = "db/FIX_DISPOSAL_ISSUES_COMPLETE.sql"
if (Test-Path $sqlFile) {
    Write-Host "SQL fix file found: $sqlFile" -ForegroundColor Green
    
    # Show the first few lines of the SQL file
    Write-Host ""
    Write-Host "Preview of the SQL script:" -ForegroundColor Cyan
    Write-Host "=========================" -ForegroundColor Cyan
    Get-Content $sqlFile -Head 10 | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
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
Write-Host "After running the SQL script, the disposal management should work properly." -ForegroundColor Green
Write-Host "The script will:" -ForegroundColor White
Write-Host "- Fix RLS permissions for disposal tables" -ForegroundColor White
Write-Host "- Create missing RPC functions" -ForegroundColor White
Write-Host "- Grant proper permissions to authenticated users" -ForegroundColor White
Write-Host "- Insert default disposal reasons" -ForegroundColor White
Write-Host ""

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")