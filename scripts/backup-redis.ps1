# Redis Backup Script (PowerShell)
#
# Performs automated backups of Redis data with:
# - RDB snapshot backups
# - AOF (Append-Only File) backups
# - Tier-based retention policies

param(
    [string]$BackupDir = "C:\backups\eduos\redis",
    [string]$RedisHost = "localhost",
    [string]$RedisPort = "6379",
    [string]$RedisDataDir = "C:\redis\data",
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
$BackupFile = "redis_backup_$Timestamp.zip"
$BackupPath = Join-Path $BackupDir $BackupFile

# Create backup directory
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Redis Backup Started" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Timestamp: $(Get-Date)"
Write-Host "Tier: $TenantTier"
Write-Host "Retention: $RetentionDays days"
Write-Host "==========================================" -ForegroundColor Cyan

try {
    # Trigger Redis BGSAVE
    Write-Host "Triggering Redis BGSAVE..."
    & redis-cli -h $RedisHost -p $RedisPort BGSAVE | Out-Null
    
    # Wait for BGSAVE to complete
    Write-Host "Waiting for BGSAVE to complete..."
    Start-Sleep -Seconds 2
    
    # Create temporary directory
    $TempDir = Join-Path $env:TEMP "redis_backup_$Timestamp"
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
    
    # Copy Redis data files
    Write-Host "Copying Redis data files..."
    $FilesToBackup = @()
    
    $RdbFile = Join-Path $RedisDataDir "dump.rdb"
    if (Test-Path $RdbFile) {
        Copy-Item $RdbFile -Destination $TempDir
        $FilesToBackup += "dump.rdb"
        Write-Host "✓ Copied dump.rdb"
    }
    
    $AofFile = Join-Path $RedisDataDir "appendonly.aof"
    if (Test-Path $AofFile) {
        Copy-Item $AofFile -Destination $TempDir
        $FilesToBackup += "appendonly.aof"
        Write-Host "✓ Copied appendonly.aof"
    }
    
    if ($FilesToBackup.Count -eq 0) {
        throw "No Redis data files found to backup!"
    }
    
    # Create compressed archive
    Write-Host "Creating compressed archive..."
    Compress-Archive -Path "$TempDir\*" -DestinationPath $BackupPath -Force
    
    # Clean up temp directory
    Remove-Item -Path $TempDir -Recurse -Force
    
    $BackupSize = (Get-Item $BackupPath).Length / 1MB
    Write-Host "Backup created: $BackupFile ($([math]::Round($BackupSize, 2)) MB)"
    
    # Calculate checksum
    Write-Host "Calculating checksum..."
    $Checksum = (Get-FileHash -Path $BackupPath -Algorithm SHA256).Hash
    $Checksum | Out-File -FilePath "$BackupPath.sha256" -Encoding ASCII
    Write-Host "✓ Checksum: $Checksum"
    
    # Create metadata
    $Metadata = @{
        timestamp = $Timestamp
        tier = $TenantTier
        size_mb = [math]::Round($BackupSize, 2)
        checksum = $Checksum
        retention_days = $RetentionDays
        expires_at = (Get-Date).AddDays($RetentionDays).ToString("yyyy-MM-dd")
        files = $FilesToBackup
    }
    $Metadata | ConvertTo-Json | Out-File -FilePath "$BackupPath.meta" -Encoding UTF8
    
    # Clean up old backups
    Write-Host "Cleaning up old backups (older than $RetentionDays days)..."
    $CutoffDate = (Get-Date).AddDays(-$RetentionDays)
    Get-ChildItem -Path $BackupDir -Filter "redis_backup_*.zip" | 
        Where-Object { $_.LastWriteTime -lt $CutoffDate } | 
        ForEach-Object {
            Remove-Item $_.FullName -Force
            Remove-Item "$($_.FullName).sha256" -Force -ErrorAction SilentlyContinue
            Remove-Item "$($_.FullName).meta" -Force -ErrorAction SilentlyContinue
        }
    
    $BackupCount = (Get-ChildItem -Path $BackupDir -Filter "redis_backup_*.zip").Count
    Write-Host "✓ Total backups retained: $BackupCount"
    
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "Redis Backup Completed Successfully" -ForegroundColor Green
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
