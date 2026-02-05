/**
 * Schema Integrity Check Job
 * 
 * Nightly job that verifies cryptographic integrity of all schema snapshots.
 * 
 * Task: 2.2.2 - Implement immutable schema snapshots with SHA-256 hashing
 * 
 * Features:
 * - Runs nightly at 2:00 AM (configurable)
 * - Verifies SHA-256 hash of all schema snapshots
 * - Logs results to schema_integrity_checks table
 * - Sends alerts if integrity violations detected
 * - Supports manual execution via API
 */

const { query } = require('../config/database');
const cron = require('node-cron');
const schemaService = require('../services/schemaService');

/**
 * Run integrity check on all schema snapshots
 */
async function runIntegrityCheck() {
  const startTime = Date.now();
  
  try {
    console.log('[Schema Integrity Check] Starting integrity verification...');
    
    // Get all schema snapshots
    const snapshotsResult = await query(`
      SELECT snapshot_id
      FROM schema_snapshots
      ORDER BY created_at ASC
    `);
    
    const snapshots = snapshotsResult.rows;
    let totalChecked = 0;
    let failedCount = 0;
    const failedSnapshots = [];
    
    // Create check record
    const checkResult = await query(`
      INSERT INTO schema_integrity_checks (check_started_at, check_status)
      VALUES (NOW(), 'running')
      RETURNING check_id
    `);
    const checkId = checkResult.rows[0].check_id;
    
    // Verify each snapshot using JavaScript hash computation (system-level)
    for (const snapshot of snapshots) {
      totalChecked++;
      
      try {
        const verification = await schemaService.verifySchemaIntegritySystem(
          snapshot.snapshot_id
        );
        
        if (!verification.is_valid) {
          failedCount++;
          failedSnapshots.push(snapshot.snapshot_id);
        }
      } catch (error) {
        // If verification fails, count as failed
        failedCount++;
        failedSnapshots.push(snapshot.snapshot_id);
        console.error(`Failed to verify snapshot ${snapshot.snapshot_id}:`, error.message);
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Update check record
    await query(`
      UPDATE schema_integrity_checks
      SET 
        check_completed_at = NOW(),
        total_snapshots_checked = $1,
        failed_snapshots = $2,
        failed_snapshot_ids = $3,
        check_status = $4,
        metadata = jsonb_build_object(
          'duration_ms', $5::integer,
          'success_rate', CASE WHEN $1 > 0 THEN (($1 - $2)::float / $1 * 100) ELSE 100 END
        )
      WHERE check_id = $6
    `, [
      totalChecked,
      failedCount,
      failedSnapshots,
      failedCount > 0 ? 'failed' : 'completed',
      duration,
      checkId
    ]);
    
    console.log('[Schema Integrity Check] Completed in', duration, 'ms');
    console.log('  - Total snapshots checked:', totalChecked);
    console.log('  - Failed snapshots:', failedCount);
    
    if (failedCount > 0) {
      console.error('[Schema Integrity Check] ⚠ INTEGRITY VIOLATIONS DETECTED!');
      console.error('  - Failed snapshot IDs:', failedSnapshots);
      
      // Send alert (implement your alerting mechanism here)
      await sendIntegrityAlert({
        check_id: checkId,
        total_checked: totalChecked,
        failed_count: failedCount,
        failed_snapshots: failedSnapshots
      });
    } else {
      console.log('[Schema Integrity Check] ✓ All snapshots verified successfully');
    }
    
    return {
      success: failedCount === 0,
      check_id: checkId,
      total_checked: totalChecked,
      failed_count: failedCount,
      failed_snapshots: failedSnapshots,
      duration_ms: duration
    };
    
  } catch (error) {
    console.error('[Schema Integrity Check] Error:', error.message);
    
    // Log the error to the database
    try {
      await query(`
        INSERT INTO schema_integrity_checks (
          check_started_at,
          check_completed_at,
          check_status,
          error_message
        )
        VALUES (NOW(), NOW(), 'failed', $1)
      `, [error.message]);
    } catch (logError) {
      console.error('[Schema Integrity Check] Failed to log error:', logError.message);
    }
    
    throw error;
  }
}

/**
 * Send alert when integrity violations are detected
 */
async function sendIntegrityAlert(checkResult) {
  // TODO: Implement your alerting mechanism
  // Options:
  // 1. Send email to admins
  // 2. Send Slack/Teams notification
  // 3. Create incident in monitoring system
  // 4. Log to security audit system
  
  console.error('[Schema Integrity Alert] Sending alert to administrators...');
  
  const alertMessage = `
    CRITICAL: Schema Integrity Violations Detected
    
    Check ID: ${checkResult.check_id}
    Total Snapshots Checked: ${checkResult.total_checked}
    Failed Snapshots: ${checkResult.failed_count}
    Failed Snapshot IDs: ${checkResult.failed_snapshots.join(', ')}
    
    Action Required: Investigate potential data tampering or corruption.
    
    Time: ${new Date().toISOString()}
  `;
  
  console.error(alertMessage);
  
  // Example: Send email (uncomment and configure)
  // await sendEmail({
  //   to: process.env.ADMIN_EMAIL,
  //   subject: 'CRITICAL: Schema Integrity Violations Detected',
  //   body: alertMessage
  // });
}

/**
 * Get integrity check history
 */
async function getIntegrityCheckHistory(limit = 30) {
  const sql = `
    SELECT * FROM schema_integrity_check_history
    LIMIT $1
  `;
  
  const result = await query(sql, [limit]);
  return result.rows;
}

/**
 * Get latest integrity check result
 */
async function getLatestIntegrityCheck() {
  const sql = `
    SELECT * FROM schema_integrity_check_history
    ORDER BY check_started_at DESC
    LIMIT 1
  `;
  
  const result = await query(sql);
  return result.rows[0] || null;
}

/**
 * Verify integrity of a single snapshot
 */
async function verifySnapshotIntegrity(snapshotId) {
  // Use system-level verification (bypasses tenant check)
  const verification = await schemaService.verifySchemaIntegritySystem(snapshotId);
  return verification;
}

/**
 * Schedule nightly integrity check
 * Runs at 2:00 AM every day by default
 */
function scheduleNightlyCheck(cronExpression = '0 2 * * *') {
  console.log(`[Schema Integrity Check] Scheduling nightly check: ${cronExpression}`);
  
  const task = cron.schedule(cronExpression, async () => {
    console.log('[Schema Integrity Check] Running scheduled integrity check...');
    
    try {
      await runIntegrityCheck();
    } catch (error) {
      console.error('[Schema Integrity Check] Scheduled check failed:', error.message);
    }
  }, {
    scheduled: true,
    timezone: process.env.TZ || 'UTC'
  });
  
  console.log('[Schema Integrity Check] Nightly check scheduled successfully');
  
  return task;
}

/**
 * Start the integrity check job
 */
function startIntegrityCheckJob() {
  // Schedule nightly check at 2:00 AM
  const cronExpression = process.env.INTEGRITY_CHECK_CRON || '0 2 * * *';
  const task = scheduleNightlyCheck(cronExpression);
  
  console.log('[Schema Integrity Check] Job started');
  
  return task;
}

/**
 * Stop the integrity check job
 */
function stopIntegrityCheckJob(task) {
  if (task) {
    task.stop();
    console.log('[Schema Integrity Check] Job stopped');
  }
}

module.exports = {
  runIntegrityCheck,
  verifySnapshotIntegrity,
  getIntegrityCheckHistory,
  getLatestIntegrityCheck,
  scheduleNightlyCheck,
  startIntegrityCheckJob,
  stopIntegrityCheckJob,
  sendIntegrityAlert
};

