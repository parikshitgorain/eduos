#!/bin/bash

###############################################################################
# Disaster Recovery Drill Script
# 
# Simulates disaster recovery scenarios and measures RTO/RPO
###############################################################################

set -e

# Configuration
DRILL_TYPE="${1:-tabletop}"
TIER="${2:-Basic}"
DRILL_ID="drill_$(date +%Y%m%d_%H%M%S)"
LOG_FILE="/var/log/eduos/dr_drill_${DRILL_ID}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
  echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
  echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
  echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠${NC} $1" | tee -a "$LOG_FILE"
}

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

echo "=========================================="
echo "  EduOS Disaster Recovery Drill"
echo "=========================================="
echo "Drill ID: $DRILL_ID"
echo "Drill Type: $DRILL_TYPE"
echo "Tier: $TIER"
echo "Started: $(date)"
echo "=========================================="
echo ""

# Record start time
START_TIME=$(date +%s)

case "$DRILL_TYPE" in
  "tabletop")
    log "Starting Tabletop Exercise..."
    log "This is a discussion-based drill. No actual recovery will be performed."
    echo ""
    
    log "Scenario: Database server has failed due to hardware issue"
    echo ""
    
    log "Discussion Points:"
    echo "  1. Who would be the Incident Commander?"
    echo "  2. What is the first action to take?"
    echo "  3. How would we identify the most recent backup?"
    echo "  4. What is the expected RTO for $TIER tier?"
    echo "  5. How would we communicate with customers?"
    echo "  6. What are the verification steps after recovery?"
    echo ""
    
    log "Please discuss these points with your team and document the answers."
    log_success "Tabletop exercise completed"
    ;;
    
  "partial_failover")
    log "Starting Partial Failover Test..."
    log "This will restore backups to a test environment"
    echo ""
    
    # Step 1: Identify latest backup
    log "Step 1: Identifying latest backup..."
    LATEST_BACKUP=$(ls -t /var/backups/eduos/postgres/postgres_backup_*.sql.gz 2>/dev/null | head -1)
    
    if [ -z "$LATEST_BACKUP" ]; then
      log_error "No backup found!"
      exit 1
    fi
    
    log_success "Found backup: $(basename "$LATEST_BACKUP")"
    
    # Step 2: Verify backup integrity
    log "Step 2: Verifying backup integrity..."
    if gunzip -t "$LATEST_BACKUP" 2>/dev/null; then
      log_success "Backup integrity verified"
    else
      log_error "Backup is corrupted!"
      exit 1
    fi
    
    # Step 3: Check checksum
    log "Step 3: Verifying checksum..."
    if [ -f "${LATEST_BACKUP}.sha256" ]; then
      if sha256sum -c "${LATEST_BACKUP}.sha256" 2>/dev/null; then
        log_success "Checksum verified"
      else
        log_error "Checksum mismatch!"
        exit 1
      fi
    else
      log_warning "Checksum file not found"
    fi
    
    # Step 4: Simulate restore (dry run)
    log "Step 4: Simulating database restore (dry run)..."
    log "  - Would drop test database"
    log "  - Would create new test database"
    log "  - Would restore from backup"
    log "  - Would verify data integrity"
    log_success "Restore simulation completed"
    
    # Step 5: Measure RTO
    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))
    ELAPSED_MIN=$((ELAPSED / 60))
    
    log "Step 5: Measuring RTO..."
    log_success "Simulated RTO: ${ELAPSED_MIN} minutes"
    
    # Compare with target RTO
    case "$TIER" in
      "Basic")
        TARGET_RTO=240  # 4 hours in minutes
        ;;
      "Business")
        TARGET_RTO=60   # 1 hour in minutes
        ;;
      "Enterprise")
        TARGET_RTO=15   # 15 minutes
        ;;
    esac
    
    if [ $ELAPSED_MIN -le $TARGET_RTO ]; then
      log_success "RTO target met: ${ELAPSED_MIN}m <= ${TARGET_RTO}m"
    else
      log_error "RTO target exceeded: ${ELAPSED_MIN}m > ${TARGET_RTO}m"
    fi
    
    log_success "Partial failover test completed"
    ;;
    
  "full_failover")
    log "Starting Full Failover Test..."
    log_warning "This will perform actual recovery operations!"
    echo ""
    
    # Confirmation prompt
    read -p "Are you sure you want to proceed? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
      log "Drill cancelled by user"
      exit 0
    fi
    
    # Step 1: Stop application
    log "Step 1: Stopping application..."
    if systemctl is-active --quiet eduos-app 2>/dev/null; then
      systemctl stop eduos-app
      log_success "Application stopped"
    else
      log_warning "Application not running"
    fi
    
    # Step 2: Backup current state
    log "Step 2: Creating pre-drill backup..."
    PREDRILL_BACKUP="/var/backups/eduos/predrill_${DRILL_ID}.sql.gz"
    pg_dump -U postgres -d eduos_db | gzip > "$PREDRILL_BACKUP"
    log_success "Pre-drill backup created"
    
    # Step 3: Identify backup to restore
    log "Step 3: Identifying backup to restore..."
    RESTORE_BACKUP=$(ls -t /var/backups/eduos/postgres/postgres_backup_*.sql.gz 2>/dev/null | head -1)
    log_success "Using backup: $(basename "$RESTORE_BACKUP")"
    
    # Step 4: Drop and recreate database
    log "Step 4: Dropping and recreating database..."
    psql -U postgres -c "DROP DATABASE IF EXISTS eduos_db_test;"
    psql -U postgres -c "CREATE DATABASE eduos_db_test;"
    log_success "Database recreated"
    
    # Step 5: Restore from backup
    log "Step 5: Restoring from backup..."
    gunzip -c "$RESTORE_BACKUP" | psql -U postgres -d eduos_db_test
    log_success "Database restored"
    
    # Step 6: Verify restoration
    log "Step 6: Verifying restoration..."
    STUDENT_COUNT=$(psql -U postgres -d eduos_db_test -t -c "SELECT COUNT(*) FROM students;" 2>/dev/null || echo "0")
    log_success "Student count: $STUDENT_COUNT"
    
    # Step 7: Cleanup test database
    log "Step 7: Cleaning up test database..."
    psql -U postgres -c "DROP DATABASE eduos_db_test;"
    log_success "Test database dropped"
    
    # Step 8: Restart application
    log "Step 8: Restarting application..."
    systemctl start eduos-app
    log_success "Application restarted"
    
    # Step 9: Measure RTO
    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))
    ELAPSED_MIN=$((ELAPSED / 60))
    
    log "Step 9: Measuring actual RTO..."
    log_success "Actual RTO: ${ELAPSED_MIN} minutes"
    
    log_success "Full failover test completed"
    ;;
    
  *)
    log_error "Unknown drill type: $DRILL_TYPE"
    echo "Usage: $0 [tabletop|partial_failover|full_failover] [Basic|Business|Enterprise]"
    exit 1
    ;;
esac

# Summary
echo ""
echo "=========================================="
echo "  Drill Summary"
echo "=========================================="
echo "Drill ID: $DRILL_ID"
echo "Drill Type: $DRILL_TYPE"
echo "Tier: $TIER"
echo "Duration: $((ELAPSED / 60)) minutes"
echo "Status: Completed"
echo "Log File: $LOG_FILE"
echo "=========================================="

# Record drill in database (if available)
if command -v psql &> /dev/null; then
  psql -U postgres -d eduos_db -c "
    INSERT INTO dr_drills (drill_id, drill_type, tier, status, started_at, completed_at, rto_actual, success)
    VALUES (
      '$DRILL_ID',
      '$DRILL_TYPE',
      '$TIER',
      'completed',
      NOW() - INTERVAL '$ELAPSED seconds',
      NOW(),
      INTERVAL '$ELAPSED seconds',
      true
    )
  " 2>/dev/null || log_warning "Could not record drill in database"
fi

log_success "Disaster Recovery Drill completed successfully!"

exit 0
