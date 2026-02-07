# PostgreSQL Backup Script (PowerShell)
#
# Performs automated backups of PostgreSQL database with:
# - Full database dumps
# - Tier-based retention policies
# - Compression
# - Backup verification

param(
    [string]$BackupDir = "C:\backups\eduos\postgres",
    [string]$DbHost = "localhost",
    [string]$DbPort = "5432",
    [string]$DbName = "eduos_db",
    [string]$DbUser = "postgres",
    [string]$DbPassword = $env:DB_PASSWORD,
    [string]$TenantTier = "Basic"
)

$ErrorActionPreference = "Stop"

# Retention periods based on tier
$RetentionDays = switch ($TenantTier) {
    "Basic" { 30 }
    "Business" { 90 }
    "Enterprise" { 365 }
    default { 30 }
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = "postgres_backup_$Timestamp.sql"
$BackupPath = Join-Path $BackupDir $BackupFile

# Create backup directory
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "PostgreSQL Backup Started" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Timestamp: $(Get-Date)"
Write-Host "Database: $DbName"
Write-Host "Tier: $TenantTier"
Write-Host "Retention: $RetentionDays days"
Write-Host "==========================================" -ForegroundColor Cyan

# Set PostgreSQL password environment variable
$env:PGPASSWORD = $DbPassword

try {
    # Perform backup
    Write-Host "Creating database dump..."
    & pg_dump -h $DbHost -p $DbPort -U $DbUser -d $DbName --format=plain --no-owner --no-acl --file=$BackupPath
    
    if (-not (Test-Path $BackupPath)) {
        throw "Backup file was not created!"
    }
    
    # Compress backup
    Write-Host "Compressing backup..."
    Compress-Archive -Path $BackupPath -DestinationPath "$BackupPath.zip" -Force
    Remove-Item $BackupPath
    
    $CompressedPath = "$BackupPath.zip"
    $BackupSize = (Get-Item $CompressedPath).Length / 1MB
    Write-Host "Backup created: $BackupFile.zip ($([math]::Round($BackupSize, 2)) MB)"
    
    # Calculate checksum
    Write-Host "Calculating checksum..."
    $Checksum = (Get-FileHash -Path $CompressedPath -Algorithm SHA256).Hash
    $Checksum | Out-File -FilePath "$CompressedPath.sha256" -Encoding ASCII
    Write-Host "✓ Checksum: $Checksum"
    
    # Create metadata
    $Metadata = @{
        timestamp = $Timestamp
        database = $DbName
        tier = $TenantTier
        size_mb = [math]::Round($BackupSize, 2)
        checksum = $Checksum
        retention_days = $RetentionDays
        expires_at = (Get-Date).AddDays($RetentionDays).ToString("yyyy-MM-dd")
    }
    $Metadata | ConvertTo-Json | Out-File -FilePath "$CompressedPath.meta" -Encoding UTF8
    
    # Clean up old backups
    Write-Host "Cleaning up old backups (older than $RetentionDays days)..."
    $CutoffDate = (Get-Date).AddDays(-$RetentionDays)
    Get-ChildItem -Path $BackupDir -Filter "postgres_backup_*.zip" | 
        Where-Object { $_.LastWriteTime -lt $CutoffDate } | 
        ForEach-Object {
            Remove-Item $_.FullName -Force
            Remove-Item "$($_.FullName).sha256" -Force -ErrorAction SilentlyContinue
            Remove-Item "$($_.FullName).meta" -Force -ErrorAction SilentlyContinue
        }
    
    $BackupCount = (Get-ChildItem -Path $BackupDir -Filter "postgres_backup_*.zip").Count
    Write-Host "✓ Total backups retained: $BackupCount"
    
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "PostgreSQL Backup Completed Successfully" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    
    exit 0
}
catch {
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "ERROR: Backup Failed" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Red
    exit 1
}
finally {
    # Clear password from environment
    $env:PGPASSWORD = $null
}
