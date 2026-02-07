# EduOS Backup and Disaster Recovery: Quick Start Guide

**Version:** 1.0  
**Last Updated:** 2026-02-07

---

## Overview

This guide provides quick instructions for setting up and using the EduOS backup and disaster recovery system.

---

## Prerequisites

- PostgreSQL 14+ installed
- Redis 7+ installed
- Node.js 18+ installed
- Sufficient disk space for backups (minimum 50GB recommended)
- Appropriate permissions to run backup scripts

---

## Setup

### 1. Run Database Migration

First, create the backup system tables:

```bash
# Run migration
node database/run_migration_023.js
```

### 2. Configure Environment Variables

Add these variables to your `.env` file:

```bash
# Backup Configuration
BACKUP_DIR=/var/backups/eduos
TENANT_TIER=Basic  # or Business, Enterprise

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=eduos_db
DB_USER=postgres
DB_PASSWORD=your_password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DATA_DIR=/var/lib/redis
```

### 3. Create Backup Directories

```bash
# Linux/Mac
sudo mkdir -p /var/backups/eduos/{postgres,redis,files}
sudo chown -R $USER:$USER /var/backups/eduos

# Windows (PowerShell as Administrator)
New-Item -ItemType Directory -Path "C:\backups\eduos\postgres" -Force
New-Item -ItemType Directory -Path "C:\backups\eduos\redis" -Force
New-Item -ItemType Directory -Path "C:\backups\eduos\files" -Force
```

### 4. Make Scripts Executable (Linux/Mac)

```bash
chmod +x scripts/backup-postgres.sh
chmod +x scripts/backup-redis.sh
chmod +x scripts/dr-drill.sh
```

---

## Manual Backup

### Full System Backup

Using the Backup Service:

```javascript
const backupService = require('./src/services/backupService');

// Perform full backup
const result = await backupService.performFullBackup('Basic');
console.log('Backup completed:', result);
```

### PostgreSQL Only

```bash
# Linux/Mac
bash scripts/backup-postgres.sh

# Windows
powershell -ExecutionPolicy Bypass -File scripts/backup-postgres.ps1
```

### Redis Only

```bash
# Linux/Mac
bash scripts/backup-redis.sh

# Windows
powershell -ExecutionPolicy Bypass -File scripts/backup-redis.ps1
```

---

## Automated Backups

### Linux/Mac (Cron)

Add to crontab (`crontab -e`):

```cron
# Daily PostgreSQL backup at 2:00 AM
0 2 * * * /path/to/eduos/scripts/backup-postgres.sh >> /var/log/eduos/backup.log 2>&1

# Daily Redis backup at 2:30 AM
30 2 * * * /path/to/eduos/scripts/backup-redis.sh >> /var/log/eduos/backup.log 2>&1
```

### Windows (Task Scheduler)

Create scheduled tasks:

```powershell
# PostgreSQL backup task
$Action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-ExecutionPolicy Bypass -File C:\path\to\eduos\scripts\backup-postgres.ps1"
$Trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
Register-ScheduledTask -TaskName "EduOS PostgreSQL Backup" `
  -Action $Action -Trigger $Trigger -Description "Daily PostgreSQL backup"

# Redis backup task
$Action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-ExecutionPolicy Bypass -File C:\path\to\eduos\scripts\backup-redis.ps1"
$Trigger = New-ScheduledTaskTrigger -Daily -At 2:30AM
Register-ScheduledTask -TaskName "EduOS Redis Backup" `
  -Action $Action -Trigger $Trigger -Description "Daily Redis backup"
```

### Node.js (node-cron)

Add to your application:

```javascript
const cron = require('node-cron');
const backupService = require('./src/services/backupService');

// Schedule daily backup at 2:00 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Starting scheduled backup...');
  try {
    const tier = process.env.TENANT_TIER || 'Basic';
    await backupService.performFullBackup(tier);
    console.log('Scheduled backup completed successfully');
  } catch (error) {
    console.error('Scheduled backup failed:', error);
  }
});
```

---

## Restore from Backup

### List Available Backups

```javascript
const backupService = require('./src/services/backupService');

// List all backups
const backups = await backupService.listBackups();
console.log('Available backups:', backups);

// List backups for specific tier
const enterpriseBackups = await backupService.listBackups({ tier: 'Enterprise' });
```

### Restore Full System

```javascript
const backupService = require('./src/services/backupService');

// Restore from specific backup
const result = await backupService.restoreFromBackup('backup_1234567890_abcd1234');
console.log('Restore completed:', result);
```

### Point-in-Time Recovery (PITR)

```javascript
const backupService = require('./src/services/backupService');

// Restore to specific point in time (last 7 days)
const targetTime = new Date('2026-02-06T14:30:00Z');
const result = await backupService.pointInTimeRecovery(targetTime);
console.log('PITR completed:', result);
```

---

## Disaster Recovery Drills

### Tabletop Exercise

Discussion-based drill (no actual recovery):

```bash
# Linux/Mac
bash scripts/dr-drill.sh tabletop Basic

# Windows
powershell -ExecutionPolicy Bypass -File scripts/dr-drill.ps1 -DrillType tabletop -Tier Basic
```

### Partial Failover Test

Simulated recovery to test environment:

```bash
# Linux/Mac
bash scripts/dr-drill.sh partial_failover Business

# Windows
powershell -ExecutionPolicy Bypass -File scripts/dr-drill.ps1 -DrillType partial_failover -Tier Business
```

### Full Failover Test

Actual recovery operations (use with caution):

```bash
# Linux/Mac
bash scripts/dr-drill.sh full_failover Enterprise

# Windows
powershell -ExecutionPolicy Bypass -File scripts/dr-drill.ps1 -DrillType full_failover -Tier Enterprise
```

---

## Monitoring and Verification

### Check Backup Status

```javascript
const backupService = require('./src/services/backupService');

// Get backup statistics
const status = await backupService.getBackupStatus();
console.log('Backup status:', status);
```

### Verify Backup Integrity

```bash
# Linux/Mac
gunzip -t /var/backups/eduos/postgres/postgres_backup_*.sql.gz
sha256sum -c /var/backups/eduos/postgres/postgres_backup_*.sql.gz.sha256

# Windows
# Checksums are verified automatically by the backup scripts
```

### Check Disk Space

```bash
# Linux/Mac
df -h /var/backups/eduos

# Windows
Get-PSDrive C | Select-Object Used,Free
```

---

## Retention Policies

Backups are automatically cleaned up based on tier:

| Tier | Retention Period | Backup Frequency |
|------|------------------|------------------|
| **Basic** | 30 days | Daily |
| **Business** | 90 days | Hourly |
| **Enterprise** | 365 days | Real-time replication |

---

## Troubleshooting

### Backup Fails

1. Check disk space: `df -h` (Linux) or `Get-PSDrive` (Windows)
2. Verify database connectivity: `psql -U postgres -d eduos_db -c "SELECT 1;"`
3. Check permissions on backup directory
4. Review logs: `/var/log/eduos/backup.log` or `C:\logs\eduos\backup.log`

### Restore Fails

1. Verify backup file exists and is not corrupted
2. Check database is accessible
3. Ensure sufficient disk space
4. Review error messages in logs

### PITR Not Available

1. Verify WAL archiving is enabled in PostgreSQL
2. Check that WAL files are being archived
3. Ensure target time is within 7-day window

---

## API Endpoints

### Trigger Manual Backup

```bash
POST /api/v1/backups
Content-Type: application/json

{
  "tier": "Basic"
}
```

### List Backups

```bash
GET /api/v1/backups?tier=Basic&status=completed
```

### Restore from Backup

```bash
POST /api/v1/backups/:backupId/restore
Content-Type: application/json

{
  "restorePostgreSQL": true,
  "restoreRedis": true
}
```

### Point-in-Time Recovery

```bash
POST /api/v1/backups/pitr
Content-Type: application/json

{
  "targetTime": "2026-02-06T14:30:00Z"
}
```

---

## Best Practices

1. **Test Backups Regularly:** Run DR drills quarterly
2. **Monitor Backup Success:** Set up alerts for failed backups
3. **Verify Integrity:** Always verify checksums after backup
4. **Document Procedures:** Keep DR plan up to date
5. **Offsite Storage:** Store backups in multiple locations
6. **Encrypt Backups:** Use encryption for sensitive data
7. **Automate Everything:** Use cron/scheduled tasks for consistency
8. **Test Restores:** Regularly test restore procedures

---

## Support

For issues or questions:
- Review the [Disaster Recovery Plan](./DISASTER_RECOVERY_PLAN.md)
- Check logs in `/var/log/eduos/` or `C:\logs\eduos\`
- Contact the operations team

---

## Next Steps

1. ✅ Set up automated daily backups
2. ✅ Schedule quarterly DR drills
3. ✅ Configure monitoring and alerts
4. ✅ Test restore procedures
5. ✅ Document custom procedures
6. ✅ Train team on DR plan

---

**Document Owner:** DevOps Team  
**Review Frequency:** Quarterly  
**Next Review Date:** 2026-05-07
