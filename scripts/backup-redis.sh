#!/bin/bash

###############################################################################
# Redis Backup Script
# 
# Performs automated backups of Redis data with:
# - RDB snapshot backups
# - AOF (Append-Only File) backups
# - Tier-based retention policies
###############################################################################

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/eduos/redis}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_DATA_DIR="${REDIS_DATA_DIR:-/data}"
TENANT_TIER="${TENANT_TIER:-Basic}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="redis_backup_${TIMESTAMP}.tar.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# Retention periods (in days) based on tier
case "$TENANT_TIER" in
  "Basic")
    RETENTION_DAYS=30
    ;;
  "Business")
    RETENTION_DAYS=90
    ;;
  "Enterprise")
    RETENTION_DAYS=365
    ;;
  *)
    RETENTION_DAYS=30
    ;;
esac

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "=========================================="
echo "Redis Backup Started"
echo "=========================================="
echo "Timestamp: $(date)"
echo "Tier: ${TENANT_TIER}"
echo "Retention: ${RETENTION_DAYS} days"
echo "=========================================="

# Trigger Redis BGSAVE (background save)
echo "Triggering Redis BGSAVE..."
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" BGSAVE

# Wait for BGSAVE to complete
echo "Waiting for BGSAVE to complete..."
while [ "$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LASTSAVE)" == "$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LASTSAVE)" ]; do
  sleep 1
done

# Create temporary directory for backup
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Copy RDB and AOF files
echo "Copying Redis data files..."
if [ -f "${REDIS_DATA_DIR}/dump.rdb" ]; then
  cp "${REDIS_DATA_DIR}/dump.rdb" "$TEMP_DIR/"
  echo "✓ Copied dump.rdb"
fi

if [ -f "${REDIS_DATA_DIR}/appendonly.aof" ]; then
  cp "${REDIS_DATA_DIR}/appendonly.aof" "$TEMP_DIR/"
  echo "✓ Copied appendonly.aof"
fi

# Create tarball
echo "Creating compressed archive..."
tar -czf "$BACKUP_PATH" -C "$TEMP_DIR" .

# Verify backup
if [ ! -f "$BACKUP_PATH" ]; then
  echo "ERROR: Backup file was not created!"
  exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
echo "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Calculate checksum
CHECKSUM=$(sha256sum "$BACKUP_PATH" | cut -d' ' -f1)
echo "$CHECKSUM" > "${BACKUP_PATH}.sha256"
echo "✓ Checksum: ${CHECKSUM}"

# Create metadata
cat > "${BACKUP_PATH}.meta" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "tier": "${TENANT_TIER}",
  "size": "${BACKUP_SIZE}",
  "checksum": "${CHECKSUM}",
  "retention_days": ${RETENTION_DAYS},
  "expires_at": "$(date -d "+${RETENTION_DAYS} days" +%Y-%m-%d)"
}
EOF

# Clean up old backups
echo "Cleaning up old backups (older than ${RETENTION_DAYS} days)..."
find "$BACKUP_DIR" -name "redis_backup_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_DIR" -name "redis_backup_*.sha256" -type f -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_DIR" -name "redis_backup_*.meta" -type f -mtime +${RETENTION_DAYS} -delete

BACKUP_COUNT=$(find "$BACKUP_DIR" -name "redis_backup_*.tar.gz" -type f | wc -l)
echo "✓ Total backups retained: ${BACKUP_COUNT}"

echo "=========================================="
echo "Redis Backup Completed Successfully"
echo "=========================================="

exit 0
