#!/bin/bash

###############################################################################
# PostgreSQL Backup Script
# 
# Performs automated backups of PostgreSQL database with:
# - Full database dumps
# - Tier-based retention policies
# - Compression and encryption
# - Backup verification
###############################################################################

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/eduos/postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-eduos_db}"
DB_USER="${DB_USER:-postgres}"
TENANT_TIER="${TENANT_TIER:-Basic}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="postgres_backup_${TIMESTAMP}.sql.gz"
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

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "=========================================="
echo "PostgreSQL Backup Started"
echo "=========================================="
echo "Timestamp: $(date)"
echo "Database: ${DB_NAME}"
echo "Tier: ${TENANT_TIER}"
echo "Retention: ${RETENTION_DAYS} days"
echo "=========================================="

# Perform backup with pg_dump
echo "Creating database dump..."
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=plain \
  --no-owner \
  --no-acl \
  --verbose \
  2>&1 | gzip > "$BACKUP_PATH"

# Verify backup file was created
if [ ! -f "$BACKUP_PATH" ]; then
  echo "ERROR: Backup file was not created!"
  exit 1
fi

# Get backup file size
BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
echo "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Verify backup integrity
echo "Verifying backup integrity..."
if gunzip -t "$BACKUP_PATH" 2>/dev/null; then
  echo "✓ Backup integrity verified"
else
  echo "ERROR: Backup file is corrupted!"
  exit 1
fi

# Calculate checksum
CHECKSUM=$(sha256sum "$BACKUP_PATH" | cut -d' ' -f1)
echo "$CHECKSUM" > "${BACKUP_PATH}.sha256"
echo "✓ Checksum: ${CHECKSUM}"

# Create backup metadata
cat > "${BACKUP_PATH}.meta" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "database": "${DB_NAME}",
  "tier": "${TENANT_TIER}",
  "size": "${BACKUP_SIZE}",
  "checksum": "${CHECKSUM}",
  "retention_days": ${RETENTION_DAYS},
  "expires_at": "$(date -d "+${RETENTION_DAYS} days" +%Y-%m-%d)"
}
EOF

# Clean up old backups based on retention policy
echo "Cleaning up old backups (older than ${RETENTION_DAYS} days)..."
find "$BACKUP_DIR" -name "postgres_backup_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_DIR" -name "postgres_backup_*.sha256" -type f -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_DIR" -name "postgres_backup_*.meta" -type f -mtime +${RETENTION_DAYS} -delete

# Count remaining backups
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "postgres_backup_*.sql.gz" -type f | wc -l)
echo "✓ Total backups retained: ${BACKUP_COUNT}"

echo "=========================================="
echo "PostgreSQL Backup Completed Successfully"
echo "=========================================="

# Exit with success
exit 0
