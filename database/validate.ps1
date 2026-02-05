# EduOS Database Validation Script
# Version: 1.0

Write-Host "========================================" -ForegroundColor Green
Write-Host "EduOS Database Validation" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$migrationFile = Join-Path $scriptPath "migrations\001_setup_rls_foundation.sql"
$rollbackFile = Join-Path $scriptPath "migrations\001_setup_rls_foundation_rollback.sql"
$testFile = Join-Path $scriptPath "tests\rls_isolation.test.sql"
$docFile = Join-Path $scriptPath "docs\RLS_POLICY_REFERENCE.md"

$allValid = $true

Write-Host "Checking migration files..." -ForegroundColor Yellow

if (Test-Path $migrationFile) {
    Write-Host "OK Migration file exists" -ForegroundColor Green
} else {
    Write-Host "FAIL Migration file not found" -ForegroundColor Red
    $allValid = $false
}

if (Test-Path $rollbackFile) {
    Write-Host "OK Rollback file exists" -ForegroundColor Green
} else {
    Write-Host "FAIL Rollback file not found" -ForegroundColor Red
    $allValid = $false
}

if (Test-Path $testFile) {
    Write-Host "OK Test file exists" -ForegroundColor Green
} else {
    Write-Host "FAIL Test file not found" -ForegroundColor Red
    $allValid = $false
}

if (Test-Path $docFile) {
    Write-Host "OK Documentation exists" -ForegroundColor Green
} else {
    Write-Host "FAIL Documentation not found" -ForegroundColor Red
    $allValid = $false
}

Write-Host ""
Write-Host "Validating SQL syntax..." -ForegroundColor Yellow

$migrationContent = Get-Content $migrationFile -Raw

if ($migrationContent -match "CREATE TABLE IF NOT EXISTS tenants") {
    Write-Host "OK Tenants table definition found" -ForegroundColor Green
} else {
    Write-Host "FAIL Tenants table definition missing" -ForegroundColor Red
    $allValid = $false
}

if ($migrationContent -match "CREATE TABLE IF NOT EXISTS students") {
    Write-Host "OK Students table definition found" -ForegroundColor Green
} else {
    Write-Host "FAIL Students table definition missing" -ForegroundColor Red
    $allValid = $false
}

if ($migrationContent -match "ENABLE ROW LEVEL SECURITY") {
    Write-Host "OK RLS enable statements found" -ForegroundColor Green
} else {
    Write-Host "FAIL RLS enable statements missing" -ForegroundColor Red
    $allValid = $false
}

if ($migrationContent -match "CREATE POLICY") {
    Write-Host "OK RLS policies found" -ForegroundColor Green
} else {
    Write-Host "FAIL RLS policies missing" -ForegroundColor Red
    $allValid = $false
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green

if ($allValid) {
    Write-Host "Validation Complete - All Checks Passed!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Start PostgreSQL or use Docker: docker-compose up -d postgres"
    Write-Host "2. Apply migration using psql"
    Write-Host "3. Run tests to verify RLS policies"
    Write-Host ""
} else {
    Write-Host "Validation Failed" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
}
