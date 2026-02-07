/**
 * Audit Dashboard Service
 * 
 * Provides analytics, anomaly detection, and compliance reporting for audit logs
 * 
 * Features:
 * - Recent activity dashboard
 * - Top users analytics
 * - Suspicious event detection
 * - Anomaly detection (unusual access patterns, bulk operations)
 * - Compliance reports (GDPR, FERPA)
 * - Real-time alert configuration
 */

const auditService = require('./auditService');

/**
 * Get dashboard summary for a tenant
 * 
 * @param {string} tenantId - Tenant ID
 * @param {Object} db - Database client
 * @param {Object} [options] - Options
 * @param {number} [options.hours] - Number of hours to look back (default: 24)
 * @returns {Promise<Object>} - Dashboard summary
 */
async function getDashboardSummary(tenantId, db, options = {}) {
  if (!db) {
    throw new Error('Database client is required');
  }

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const hours = options.hours || 24;
  const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

  // Get recent activity count
  const activityResult = await db.query(
    `SELECT COUNT(*) as total_events
     FROM audit_logs
     WHERE tenant_id = $1 AND created_at >= $2`,
    [tenantId, startDate]
  );

  // Get unique users count
  const usersResult = await db.query(
    `SELECT COUNT(DISTINCT user_id) as unique_users
     FROM audit_logs
     WHERE tenant_id = $1 AND created_at >= $2 AND user_id IS NOT NULL`,
    [tenantId, startDate]
  );

  // Get failed login attempts
  const failedLoginsResult = await db.query(
    `SELECT COUNT(*) as failed_logins
     FROM audit_logs
     WHERE tenant_id = $1 
       AND created_at >= $2
       AND event_type = 'login_failed'`,
    [tenantId, startDate]
  );

  // Get critical events
  const criticalEventsResult = await db.query(
    `SELECT COUNT(*) as critical_events
     FROM audit_logs
     WHERE tenant_id = $1 
       AND created_at >= $2
       AND severity = 'critical'`,
    [tenantId, startDate]
  );

  // Get suspicious events count
  const suspiciousEvents = await detectSuspiciousEvents(tenantId, db, { hours });

  return {
    period_hours: hours,
    start_date: startDate.toISOString(),
    total_events: parseInt(activityResult.rows[0].total_events),
    unique_users: parseInt(usersResult.rows[0].unique_users),
    failed_logins: parseInt(failedLoginsResult.rows[0].failed_logins),
    critical_events: parseInt(criticalEventsResult.rows[0].critical_events),
    suspicious_events: suspiciousEvents.length,
  };
}

/**
 * Get recent activity
 * 
 * @param {string} tenantId - Tenant ID
 * @param {Object} db - Database client
 * @param {Object} [options] - Options
 * @param {number} [options.limit] - Limit number of results (default: 50)
 * @param {number} [options.hours] - Number of hours to look back (default: 24)
 * @returns {Promise<Array>} - Recent activity
 */
async function getRecentActivity(tenantId, db, options = {}) {
  if (!db) {
    throw new Error('Database client is required');
  }

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const limit = options.limit || 50;
  const hours = options.hours || 24;
  const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

  const result = await db.query(
    `SELECT id, event_type, action, resource_type, resource_id,
            user_id, user_email, user_role, severity, status,
            created_at
     FROM audit_logs
     WHERE tenant_id = $1 AND created_at >= $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [tenantId, startDate, limit]
  );

  return result.rows;
}

/**
 * Get top users by activity
 * 
 * @param {string} tenantId - Tenant ID
 * @param {Object} db - Database client
 * @param {Object} [options] - Options
 * @param {number} [options.limit] - Limit number of results (default: 10)
 * @param {number} [options.hours] - Number of hours to look back (default: 24)
 * @returns {Promise<Array>} - Top users
 */
async function getTopUsers(tenantId, db, options = {}) {
  if (!db) {
    throw new Error('Database client is required');
  }

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const limit = options.limit || 10;
  const hours = options.hours || 24;
  const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

  const result = await db.query(
    `SELECT user_id, user_email, user_role,
            COUNT(*) as event_count,
            COUNT(DISTINCT event_type) as unique_event_types,
            MAX(created_at) as last_activity
     FROM audit_logs
     WHERE tenant_id = $1 
       AND created_at >= $2
       AND user_id IS NOT NULL
     GROUP BY user_id, user_email, user_role
     ORDER BY event_count DESC
     LIMIT $3`,
    [tenantId, startDate, limit]
  );

  return result.rows.map(row => ({
    user_id: row.user_id,
    user_email: row.user_email,
    user_role: row.user_role,
    event_count: parseInt(row.event_count),
    unique_event_types: parseInt(row.unique_event_types),
    last_activity: row.last_activity,
  }));
}

/**
 * Detect suspicious events
 * 
 * @param {string} tenantId - Tenant ID
 * @param {Object} db - Database client
 * @param {Object} [options] - Options
 * @param {number} [options.hours] - Number of hours to look back (default: 24)
 * @returns {Promise<Array>} - Suspicious events
 */
async function detectSuspiciousEvents(tenantId, db, options = {}) {
  if (!db) {
    throw new Error('Database client is required');
  }

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const hours = options.hours || 24;
  const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

  const suspiciousEvents = [];

  // 1. Multiple failed login attempts from same user
  const failedLoginsResult = await db.query(
    `SELECT user_email, COUNT(*) as failed_count,
            array_agg(DISTINCT ip_address::text) as ip_addresses,
            MIN(created_at) as first_attempt,
            MAX(created_at) as last_attempt
     FROM audit_logs
     WHERE tenant_id = $1 
       AND created_at >= $2
       AND event_type = 'login_failed'
       AND user_email IS NOT NULL
     GROUP BY user_email
     HAVING COUNT(*) >= 5
     ORDER BY failed_count DESC`,
    [tenantId, startDate]
  );

  failedLoginsResult.rows.forEach(row => {
    suspiciousEvents.push({
      type: 'multiple_failed_logins',
      severity: 'critical',
      description: `${row.failed_count} failed login attempts for ${row.user_email}`,
      details: {
        user_email: row.user_email,
        failed_count: parseInt(row.failed_count),
        ip_addresses: row.ip_addresses,
        first_attempt: row.first_attempt,
        last_attempt: row.last_attempt,
      },
    });
  });

  // 2. Bulk operations (deletions, modifications)
  const bulkOpsResult = await db.query(
    `SELECT user_id, user_email, event_type, action,
            COUNT(*) as operation_count,
            MIN(created_at) as first_operation,
            MAX(created_at) as last_operation
     FROM audit_logs
     WHERE tenant_id = $1 
       AND created_at >= $2
       AND event_type IN ('bulk_deletion', 'bulk_modification', 'bulk_export')
     GROUP BY user_id, user_email, event_type, action
     ORDER BY operation_count DESC`,
    [tenantId, startDate]
  );

  bulkOpsResult.rows.forEach(row => {
    suspiciousEvents.push({
      type: 'bulk_operation',
      severity: 'warning',
      description: `Bulk ${row.event_type} operation by ${row.user_email || 'unknown user'}`,
      details: {
        user_id: row.user_id,
        user_email: row.user_email,
        event_type: row.event_type,
        action: row.action,
        operation_count: parseInt(row.operation_count),
        first_operation: row.first_operation,
        last_operation: row.last_operation,
      },
    });
  });

  // 3. Access from unusual IP addresses
  const unusualIpResult = await db.query(
    `WITH user_ips AS (
       SELECT user_id, ip_address::text as ip,
              COUNT(*) as access_count,
              MIN(created_at) as first_seen
       FROM audit_logs
       WHERE tenant_id = $1 
         AND created_at >= $2
         AND user_id IS NOT NULL
         AND ip_address IS NOT NULL
       GROUP BY user_id, ip_address
     ),
     user_ip_counts AS (
       SELECT user_id, COUNT(DISTINCT ip) as ip_count
       FROM user_ips
       GROUP BY user_id
     )
     SELECT ui.user_id, 
            (SELECT user_email FROM audit_logs WHERE user_id = ui.user_id LIMIT 1) as user_email,
            ui.ip, ui.access_count, ui.first_seen,
            uic.ip_count
     FROM user_ips ui
     JOIN user_ip_counts uic ON ui.user_id = uic.user_id
     WHERE uic.ip_count >= 3
     ORDER BY uic.ip_count DESC, ui.access_count DESC`,
    [tenantId, startDate]
  );

  const userIpMap = new Map();
  unusualIpResult.rows.forEach(row => {
    if (!userIpMap.has(row.user_id)) {
      userIpMap.set(row.user_id, {
        user_id: row.user_id,
        user_email: row.user_email,
        ip_count: parseInt(row.ip_count),
        ips: [],
      });
    }
    userIpMap.get(row.user_id).ips.push({
      ip: row.ip,
      access_count: parseInt(row.access_count),
      first_seen: row.first_seen,
    });
  });

  userIpMap.forEach(userData => {
    suspiciousEvents.push({
      type: 'unusual_ip_access',
      severity: 'warning',
      description: `User ${userData.user_email} accessed from ${userData.ip_count} different IP addresses`,
      details: userData,
    });
  });

  // 4. Permission escalation attempts
  const permissionEscalationResult = await db.query(
    `SELECT user_id, user_email, 
            COUNT(*) as escalation_attempts,
            array_agg(DISTINCT event_type) as event_types,
            MIN(created_at) as first_attempt,
            MAX(created_at) as last_attempt
     FROM audit_logs
     WHERE tenant_id = $1 
       AND created_at >= $2
       AND (event_type IN ('permission_granted', 'role_assigned')
            OR (status = 'failure' AND action IN ('grant', 'update')))
     GROUP BY user_id, user_email
     HAVING COUNT(*) >= 3
     ORDER BY escalation_attempts DESC`,
    [tenantId, startDate]
  );

  permissionEscalationResult.rows.forEach(row => {
    suspiciousEvents.push({
      type: 'permission_escalation',
      severity: 'critical',
      description: `Potential permission escalation by ${row.user_email || 'unknown user'}`,
      details: {
        user_id: row.user_id,
        user_email: row.user_email,
        escalation_attempts: parseInt(row.escalation_attempts),
        event_types: row.event_types,
        first_attempt: row.first_attempt,
        last_attempt: row.last_attempt,
      },
    });
  });

  return suspiciousEvents;
}

/**
 * Detect anomalies in access patterns
 * 
 * @param {string} tenantId - Tenant ID
 * @param {Object} db - Database client
 * @param {Object} [options] - Options
 * @param {number} [options.hours] - Number of hours to look back (default: 24)
 * @returns {Promise<Array>} - Detected anomalies
 */
async function detectAnomalies(tenantId, db, options = {}) {
  if (!db) {
    throw new Error('Database client is required');
  }

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const hours = options.hours || 24;
  const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

  const anomalies = [];

  // 1. Unusual time access (outside business hours)
  const afterHoursResult = await db.query(
    `SELECT user_id, user_email,
            COUNT(*) as after_hours_count,
            array_agg(DISTINCT event_type) as event_types,
            MIN(created_at) as first_access,
            MAX(created_at) as last_access
     FROM audit_logs
     WHERE tenant_id = $1 
       AND created_at >= $2
       AND user_id IS NOT NULL
       AND (EXTRACT(HOUR FROM created_at) < 6 OR EXTRACT(HOUR FROM created_at) > 22)
     GROUP BY user_id, user_email
     HAVING COUNT(*) >= 5
     ORDER BY after_hours_count DESC`,
    [tenantId, startDate]
  );

  afterHoursResult.rows.forEach(row => {
    anomalies.push({
      type: 'after_hours_access',
      severity: 'warning',
      description: `User ${row.user_email} accessed system ${row.after_hours_count} times outside business hours`,
      details: {
        user_id: row.user_id,
        user_email: row.user_email,
        after_hours_count: parseInt(row.after_hours_count),
        event_types: row.event_types,
        first_access: row.first_access,
        last_access: row.last_access,
      },
    });
  });

  // 2. Rapid successive operations
  const rapidOpsResult = await db.query(
    `WITH time_diffs AS (
       SELECT user_id, user_email, event_type, created_at,
              LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at) as prev_time
       FROM audit_logs
       WHERE tenant_id = $1 
         AND created_at >= $2
         AND user_id IS NOT NULL
     ),
     rapid_ops AS (
       SELECT user_id, user_email,
              COUNT(*) as rapid_count
       FROM time_diffs
       WHERE EXTRACT(EPOCH FROM (created_at - prev_time)) < 1
       GROUP BY user_id, user_email
       HAVING COUNT(*) >= 10
     )
     SELECT * FROM rapid_ops
     ORDER BY rapid_count DESC`,
    [tenantId, startDate]
  );

  rapidOpsResult.rows.forEach(row => {
    anomalies.push({
      type: 'rapid_operations',
      severity: 'warning',
      description: `User ${row.user_email} performed ${row.rapid_count} operations in rapid succession (< 1 second apart)`,
      details: {
        user_id: row.user_id,
        user_email: row.user_email,
        rapid_count: parseInt(row.rapid_count),
      },
    });
  });

  // 3. Unusual data export volume
  const exportVolumeResult = await db.query(
    `SELECT user_id, user_email,
            COUNT(*) as export_count,
            array_agg(DISTINCT resource_type) as resource_types,
            MIN(created_at) as first_export,
            MAX(created_at) as last_export
     FROM audit_logs
     WHERE tenant_id = $1 
       AND created_at >= $2
       AND event_type IN ('data_export', 'bulk_export')
     GROUP BY user_id, user_email
     HAVING COUNT(*) >= 5
     ORDER BY export_count DESC`,
    [tenantId, startDate]
  );

  exportVolumeResult.rows.forEach(row => {
    anomalies.push({
      type: 'unusual_export_volume',
      severity: 'critical',
      description: `User ${row.user_email || 'unknown'} performed ${row.export_count} data exports`,
      details: {
        user_id: row.user_id,
        user_email: row.user_email,
        export_count: parseInt(row.export_count),
        resource_types: row.resource_types,
        first_export: row.first_export,
        last_export: row.last_export,
      },
    });
  });

  return anomalies;
}

/**
 * Generate GDPR compliance report
 * 
 * @param {string} tenantId - Tenant ID
 * @param {Object} db - Database client
 * @param {Object} [options] - Options
 * @param {Date} [options.startDate] - Start date
 * @param {Date} [options.endDate] - End date
 * @returns {Promise<Object>} - GDPR compliance report
 */
async function generateGDPRReport(tenantId, db, options = {}) {
  if (!db) {
    throw new Error('Database client is required');
  }

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = options.endDate || new Date();

  // Data access requests
  const dataAccessResult = await db.query(
    `SELECT COUNT(*) as total_access,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(DISTINCT resource_id) as unique_resources
     FROM audit_logs
     WHERE tenant_id = $1 
       AND created_at BETWEEN $2 AND $3
       AND event_type = 'data_access'`,
    [tenantId, startDate, endDate]
  );

  // Data modifications
  const dataModificationResult = await db.query(
    `SELECT COUNT(*) as total_modifications,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(DISTINCT resource_id) as unique_resources
     FROM audit_logs
     WHERE tenant_id = $1 
       AND created_at BETWEEN $2 AND $3
       AND event_type IN ('data_modification', 'bulk_modification')`,
    [tenantId, startDate, endDate]
  );

  // Data deletions
  const dataDeletionResult = await db.query(
    `SELECT COUNT(*) as total_deletions,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(DISTINCT resource_id) as unique_resources
     FROM audit_logs
     WHERE tenant_id = $1 
       AND created_at BETWEEN $2 AND $3
       AND event_type IN ('data_deletion', 'bulk_deletion')`,
    [tenantId, startDate, endDate]
  );

  // Data exports
  const dataExportResult = await db.query(
    `SELECT COUNT(*) as total_exports,
            COUNT(DISTINCT user_id) as unique_users
     FROM audit_logs
     WHERE tenant_id = $1 
       AND created_at BETWEEN $2 AND $3
       AND event_type IN ('data_export', 'bulk_export')`,
    [tenantId, startDate, endDate]
  );

  // Consent changes (if tracked)
  const consentResult = await db.query(
    `SELECT COUNT(*) as consent_changes
     FROM audit_logs
     WHERE tenant_id = $1 
       AND created_at BETWEEN $2 AND $3
       AND event_type LIKE '%consent%'`,
    [tenantId, startDate, endDate]
  );

  return {
    report_type: 'GDPR',
    tenant_id: tenantId,
    period: {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    },
    data_access: {
      total_access: parseInt(dataAccessResult.rows[0].total_access),
      unique_users: parseInt(dataAccessResult.rows[0].unique_users),
      unique_resources: parseInt(dataAccessResult.rows[0].unique_resources),
    },
    data_modifications: {
      total_modifications: parseInt(dataModificationResult.rows[0].total_modifications),
      unique_users: parseInt(dataModificationResult.rows[0].unique_users),
      unique_resources: parseInt(dataModificationResult.rows[0].unique_resources),
    },
    data_deletions: {
      total_deletions: parseInt(dataDeletionResult.rows[0].total_deletions),
      unique_users: parseInt(dataDeletionResult.rows[0].unique_users),
      unique_resources: parseInt(dataDeletionResult.rows[0].unique_resources),
    },
    data_exports: {
      total_exports: parseInt(dataExportResult.rows[0].total_exports),
      unique_users: parseInt(dataExportResult.rows[0].unique_users),
    },
    consent_changes: parseInt(consentResult.rows[0].consent_changes),
    generated_at: new Date().toISOString(),
  };
}

/**
 * Generate FERPA compliance report
 * 
 * @param {string} tenantId - Tenant ID
 * @param {Object} db - Database client
 * @param {Object} [options] - Options
 * @param {Date} [options.startDate] - Start date
 * @param {Date} [options.endDate] - End date
 * @returns {Promise<Object>} - FERPA compliance report
 */
async function generateFERPAReport(tenantId, db, options = {}) {
  if (!db) {
    throw new Error('Database client is required');
  }

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = options.endDate || new Date();

  // Student record access
  const studentAccessResult = await db.query(
    `SELECT COUNT(*) as total_access,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(DISTINCT resource_id) as unique_students
     FROM audit_logs
     WHERE tenant_id = $1 
       AND created_at BETWEEN $2 AND $3
       AND event_type = 'data_access'
       AND resource_type = 'student'`,
    [tenantId, startDate, endDate]
  );

  // Student record modifications
  const studentModificationResult = await db.query(
    `SELECT COUNT(*) as total_modifications,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(DISTINCT resource_id) as unique_students
     FROM audit_logs
     WHERE tenant_id = $1 
       AND created_at BETWEEN $2 AND $3
       AND event_type IN ('data_modification', 'bulk_modification')
       AND resource_type = 'student'`,
    [tenantId, startDate, endDate]
  );

  // Grade access
  const gradeAccessResult = await db.query(
    `SELECT COUNT(*) as total_access,
            COUNT(DISTINCT user_id) as unique_users
     FROM audit_logs
     WHERE tenant_id = $1 
       AND created_at BETWEEN $2 AND $3
       AND event_type = 'data_access'
       AND resource_type IN ('grade', 'assessment')`,
    [tenantId, startDate, endDate]
  );

  // Unauthorized access attempts
  const unauthorizedResult = await db.query(
    `SELECT COUNT(*) as unauthorized_attempts,
            COUNT(DISTINCT user_id) as unique_users
     FROM audit_logs
     WHERE tenant_id = $1 
       AND created_at BETWEEN $2 AND $3
       AND status = 'failure'
       AND action = 'read'
       AND resource_type IN ('student', 'grade', 'assessment')`,
    [tenantId, startDate, endDate]
  );

  // Directory information disclosures
  const disclosureResult = await db.query(
    `SELECT COUNT(*) as total_disclosures,
            COUNT(DISTINCT user_id) as unique_users
     FROM audit_logs
     WHERE tenant_id = $1 
       AND created_at BETWEEN $2 AND $3
       AND event_type IN ('data_export', 'bulk_export')
       AND resource_type = 'student'`,
    [tenantId, startDate, endDate]
  );

  return {
    report_type: 'FERPA',
    tenant_id: tenantId,
    period: {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    },
    student_record_access: {
      total_access: parseInt(studentAccessResult.rows[0].total_access),
      unique_users: parseInt(studentAccessResult.rows[0].unique_users),
      unique_students: parseInt(studentAccessResult.rows[0].unique_students),
    },
    student_record_modifications: {
      total_modifications: parseInt(studentModificationResult.rows[0].total_modifications),
      unique_users: parseInt(studentModificationResult.rows[0].unique_users),
      unique_students: parseInt(studentModificationResult.rows[0].unique_students),
    },
    grade_access: {
      total_access: parseInt(gradeAccessResult.rows[0].total_access),
      unique_users: parseInt(gradeAccessResult.rows[0].unique_users),
    },
    unauthorized_attempts: {
      total_attempts: parseInt(unauthorizedResult.rows[0].unauthorized_attempts),
      unique_users: parseInt(unauthorizedResult.rows[0].unique_users),
    },
    directory_disclosures: {
      total_disclosures: parseInt(disclosureResult.rows[0].total_disclosures),
      unique_users: parseInt(disclosureResult.rows[0].unique_users),
    },
    generated_at: new Date().toISOString(),
  };
}

module.exports = {
  getDashboardSummary,
  getRecentActivity,
  getTopUsers,
  detectSuspiciousEvents,
  detectAnomalies,
  generateGDPRReport,
  generateFERPAReport,
};
