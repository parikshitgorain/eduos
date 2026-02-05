# Reset PostgreSQL Password Script
# Run this as Administrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PostgreSQL Password Reset Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$pgPath = "C:\Program Files\PostgreSQL\18"
$pgDataPath = "$pgPath\data"
$pgHbaFile = "$pgDataPath\pg_hba.conf"
$psqlExe = "$pgPath\bin\psql.exe"

# Step 1: Backup pg_hba.conf
Write-Host "Step 1: Backing up pg_hba.conf..." -ForegroundColor Yellow
Copy-Item $pgHbaFile "$pgHbaFile.backup" -Force
Write-Host "[OK] Backup created" -ForegroundColor Green
Write-Host ""

# Step 2: Modify pg_hba.conf to allow trust authentication
Write-Host "Step 2: Modifying pg_hba.conf..." -ForegroundColor Yellow
$content = Get-Content $pgHbaFile
$newContent = $content -replace 'scram-sha-256', 'trust'
$newContent | Set-Content $pgHbaFile
Write-Host "[OK] Authentication changed to trust" -ForegroundColor Green
Write-Host ""

# Step 3: Restart PostgreSQL service
Write-Host "Step 3: Restarting PostgreSQL service..." -ForegroundColor Yellow
Restart-Service postgresql-x64-18
Start-Sleep -Seconds 3
Write-Host "[OK] Service restarted" -ForegroundColor Green
Write-Host ""

# Step 4: Reset password
Write-Host "Step 4: Resetting postgres user password..." -ForegroundColor Yellow
$env:PGPASSWORD = ""
& $psqlExe -U postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Password reset to postgres" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Failed to reset password" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 5: Restore pg_hba.conf
Write-Host "Step 5: Restoring pg_hba.conf..." -ForegroundColor Yellow
Copy-Item "$pgHbaFile.backup" $pgHbaFile -Force
Write-Host "[OK] Original authentication restored" -ForegroundColor Green
Write-Host ""

# Step 6: Restart PostgreSQL service again
Write-Host "Step 6: Final restart..." -ForegroundColor Yellow
Restart-Service postgresql-x64-18
Start-Sleep -Seconds 3
Write-Host "[OK] Service restarted" -ForegroundColor Green
Write-Host ""

# Step 7: Test connection
Write-Host "Step 7: Testing connection..." -ForegroundColor Yellow
$env:PGPASSWORD = "postgres"
& $psqlExe -U postgres -c "SELECT version();" | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Connection successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "SUCCESS! Password reset complete" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "You can now run:" -ForegroundColor Yellow
    Write-Host "  npm run setup" -ForegroundColor White
    Write-Host "  npm test" -ForegroundColor White
} else {
    Write-Host "[ERROR] Connection failed" -ForegroundColor Red
    Write-Host "Please check the error messages above" -ForegroundColor Yellow
}
