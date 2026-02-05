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

/**
 * Run integrity check on all schema snapshots
 */
async function runIntegrityCheck() {
  const startTime = Date.now();
  
  try {
    console.log('[Schema Integrity Check] Starting integrity verification...');
    
    // Call the database function to verify all snapshots
    const result = await query('SELECT * FROM verify_all_schema_integrity()');
    
    if (result.rows.length === 0) {
      throw new Error('Integrity check function returned no results');
    }
    
    const checkResult = result.rows[0];
    const duration = Date.now() - startTime;
    
    console.log('[Schema Integrity Check] Completed in', duration, 'ms');
    console.log('  - Total snapshots checked:', checkResult.total_checked);
    console.log('  - Failed snapshots:', checkResult.failed_count);
    
    if (checkResult.failed_count > 0) {
      console.error('[Schema Integrity Check] ⚠ INTEGRITY VIOLATIONS DETECTED!');
      console.error('  - Failed snapshot IDs:', checkResult.failed_snapshots);
      
      // Send alert (implement your alerting mechanism here)
      await sendIntegrityAlert(checkResult);
    } else {
      console.log('[Schema Integrity Check] ✓ All snapshots verified successfully');
    }
    
    return {
      success: checkResult.failed_count === 0,
      check_id: checkResult.check_id,
      total_checked: checkResult.total_checked,
      failed_count: checkResult.failed_count,
      failed_snapshots: checkResult.failed_snapshots,
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
  const sql = `SELECT * FROM verify_schema_integrity($1)`;
  
  const result = await query(sql, [snapshotId]);
  
  if (result.rows.length === 0) {
    throw new Error(`Schema snapshot not found: ${snapshotId}`);
  }
  
  return result.rows[0];
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

