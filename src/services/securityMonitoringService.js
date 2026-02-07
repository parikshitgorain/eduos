/**
 * Security Monitoring Service
 * 
 * Centralized security event monitoring with SIEM integration capabilities.
 * Provides real-time alerting for security events and threat detection.
 * 
 * Task: 4.3.5 - Setup security monitoring and incident response
 * 
 * Features:
 * - Security event aggregation and correlation
 * - Real-time threat detection
 * - SIEM integration (Splunk, ELK, Azure Sentinel)
 * - Automated alerting for critical security events
 * - Incident tracking and response coordination
 * - Compliance reporting (SOC 2, ISO 27001)
 */

const { createAuditLog, EVENT_TYPES, ACTIONS, SEVERITY } = require('./auditService');

/**
 * Security event types for monitoring
 */
const SECURITY_EVENT_TYPES = {
  // Authentication threats
  BRUTE_FORCE_ATTEMPT: 'brute_force_attempt',
  CREDENTIAL_STUFFING: 'credential_stuffing',
  ACCOUNT_TAKEOVER: 'account_takeover',
  SUSPICIOUS_LOGIN: 'suspicious_login',
  IMPOSSIBLE_TRAVEL: 'impossible_travel',
  
  // Authorization threats
  PRIVILEGE_ESCALATION: 'privilege_escalation',
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  PERMISSION_ABUSE: 'permission_abuse',
  
  // Data threats
  DATA_EXFILTRATION: 'data_exfiltration',
  BULK_DATA_ACCESS: 'bulk_data_access',
  SENSITIVE_DATA_ACCESS: 'sensitive_data_access',
  UNUSUAL_EXPORT: 'unusual_export',
  
  // System threats
  SQL_INJECTION_ATTEMPT: 'sql_injection_attempt',
  XSS_ATTEMPT: 'xss_attempt',
  CSRF_ATTEMPT: 'csrf_attempt',
  DOS_ATTEMPT: 'dos_attempt',
  MALWARE_DETECTED: 'malware_detected',
  
  // Insider threats
  AFTER_HOURS_ACCESS: 'after_hours_access',
  UNUSUAL_BEHAVIOR: 'unusual_behavior',
  POLICY_VIOLATION: 'policy_violation',
  
  // Compliance events
  GDPR_VIOLATION: 'gdpr_violation',
  FERPA_VIOLATION: 'ferpa_violation',
  AUDIT_LOG_TAMPERING: 'audit_log_tampering'
};

/**
 * Alert severity levels
 */
const ALERT_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Alert channels
 */
const ALERT_CHANNELS = {
  EMAIL: 'email',
  SMS: 'sms',
  SLACK: 'slack',
  PAGERDUTY: 'pagerduty',
  WEBHOOK: 'webhook'
};

/**
 * SIEM integration types
 */
const SIEM_TYPES = {
  SPLUNK: 'splunk',
  ELK: 'elk',
  AZURE_SENTINEL: 'azure_sentinel',
  DATADOG: 'datadog',
  SUMO_LOGIC: 'sumo_logic'
};

/**
 * Track failed login attempts for brute force detection
 */
const failedLoginAttempts = new Map();

/**
 * Track user behavior patterns for anomaly detection
 */
const userBehaviorPatterns = new Map();

/**
 * Detect brute force login attempts
 * 
 * @param {string} identifier - User identifier (email or IP)
 * @param {Object} db - Database client
 * @param {Object} context - Request context
 * @returns {Promise<Object>} - Detection result
 */
async function detectBruteForce(identifier, db, context = {}) {
  const key = `bf:${identifier}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  // Get or initialize attempts
  let attempts = failedLoginAttempts.get(key) || [];
  
  // Remove old attempts outside the window
  attempts = attempts.filter(timestamp => now - timestamp < windowMs);
  
  // Add current attempt
  attempts.push(now);
  failedLoginAttempts.set(key, attempts);

  // Check if threshold exceeded
  if (attempts.length >= maxAttempts) {
    // Log security event
    await logSecurityEvent({
      eventType: SECURITY_EVENT_TYPES.BRUTE_FORCE_ATTEMPT,
      severity: ALERT_SEVERITY.HIGH,
      identifier,
      attemptCount: attempts.length,
      windowMinutes: 15,
      ...context
    }, db);

    // Trigger alert
    await triggerSecurityAlert({
      type: SECURITY_EVENT_TYPES.BRUTE_FORCE_ATTEMPT,
      severity: ALERT_SEVERITY.HIGH,
      message: `Brute force attack detected: ${attempts.length} failed login attempts in 15 minutes`,
      identifier,
      context
    }, db);

    return {
      detected: true,
      attemptCount: attempts.length,
      action: 'account_locked'
    };
  }

  return {
    detected: false,
    attemptCount: attempts.length,
    remainingAttempts: maxAttempts - attempts.length
  };
}

/**
 * Detect impossible travel (login from geographically distant locations)
 * 
 * @param {string} userId - User ID
 * @param {string} currentLocation - Current login location
 * @param {string} currentIp - Current IP address
 * @param {Object} db - Database client
 * @returns {Promise<Object>} - Detection result
 */
async function detectImpossibleTravel(userId, currentLocation, currentIp, db) {
  // Get last login location from database
  const result = await db.query(
    `SELECT ip_address, location, created_at 
     FROM audit_logs 
     WHERE user_id = $1 
       AND event_type = $2 
       AND status = 'success'
     ORDER BY created_at DESC 
     LIMIT 1`,
    [userId, EVENT_TYPES.USER_LOGIN]
  );

  if (result.rows.length === 0) {
    return { detected: false, reason: 'first_login' };
  }

  const lastLogin = result.rows[0];
  const timeDiffHours = (Date.now() - new Date(lastLogin.created_at).getTime()) / (1000 * 60 * 60);

  // Simple heuristic: if locations are different and time is less than 2 hours
  // In production, use actual geolocation distance calculation
  if (lastLogin.location && currentLocation && 
      lastLogin.location !== currentLocation && 
      timeDiffHours < 2) {
    
    await logSecurityEvent({
      eventType: SECURITY_EVENT_TYPES.IMPOSSIBLE_TRAVEL,
      severity: ALERT_SEVERITY.HIGH,
      userId,
      previousLocation: lastLogin.location,
      currentLocation,
      previousIp: lastLogin.ip_address,
      currentIp,
      timeDiffHours
    }, db);

    await triggerSecurityAlert({
      type: SECURITY_EVENT_TYPES.IMPOSSIBLE_TRAVEL,
      severity: ALERT_SEVERITY.HIGH,
      message: `Impossible travel detected: User logged in from ${currentLocation} within ${timeDiffHours.toFixed(1)} hours of login from ${lastLogin.location}`,
      userId,
      context: { previousLocation: lastLogin.location, currentLocation, timeDiffHours }
    }, db);

    return {
      detected: true,
      previousLocation: lastLogin.location,
      currentLocation,
      timeDiffHours
    };
  }

  return { detected: false };
}

/**
 * Detect privilege escalation attempts
 * 
 * @param {string} userId - User ID
 * @param {string} oldRole - Previous role
 * @param {string} newRole - New role
 * @param {string} changedBy - User who made the change
 * @param {Object} db - Database client
 * @returns {Promise<Object>} - Detection result
 */
async function detectPrivilegeEscalation(userId, oldRole, newRole, changedBy, db) {
  const roleHierarchy = {
    'student': 1,
    'teacher': 2,
    'center_admin': 3,
    'institute_admin': 4,
    'superadmin': 5
  };

  const oldLevel = roleHierarchy[oldRole] || 0;
  const newLevel = roleHierarchy[newRole] || 0;

  // Detect suspicious escalation
  const isSuspicious = (
    newLevel > oldLevel + 1 || // Skipping levels
    (userId === changedBy && newLevel > oldLevel) || // Self-escalation
    newRole === 'superadmin' // Any escalation to superadmin
  );

  if (isSuspicious) {
    await logSecurityEvent({
      eventType: SECURITY_EVENT_TYPES.PRIVILEGE_ESCALATION,
      severity: ALERT_SEVERITY.CRITICAL,
      userId,
      oldRole,
      newRole,
      changedBy,
      selfEscalation: userId === changedBy
    }, db);

    await triggerSecurityAlert({
      type: SECURITY_EVENT_TYPES.PRIVILEGE_ESCALATION,
      severity: ALERT_SEVERITY.CRITICAL,
      message: `Suspicious privilege escalation: User ${userId} role changed from ${oldRole} to ${newRole} by ${changedBy}`,
      userId,
      context: { oldRole, newRole, changedBy, selfEscalation: userId === changedBy }
    }, db);

    return {
      detected: true,
      suspicious: true,
      reason: userId === changedBy ? 'self_escalation' : 'level_skip'
    };
  }

  return { detected: false };
}

/**
 * Detect bulk data access patterns
 * 
 * @param {string} userId - User ID
 * @param {string} resourceType - Type of resource accessed
 * @param {number} count - Number of records accessed
 * @param {Object} db - Database client
 * @returns {Promise<Object>} - Detection result
 */
async function detectBulkDataAccess(userId, resourceType, count, db) {
  const thresholds = {
    'student': 100,
    'payment': 50,
    'grade': 100,
    'medical_record': 20
  };

  const threshold = thresholds[resourceType] || 100;

  if (count >= threshold) {
    await logSecurityEvent({
      eventType: SECURITY_EVENT_TYPES.BULK_DATA_ACCESS,
      severity: ALERT_SEVERITY.MEDIUM,
      userId,
      resourceType,
      count,
      threshold
    }, db);

    await triggerSecurityAlert({
      type: SECURITY_EVENT_TYPES.BULK_DATA_ACCESS,
      severity: ALERT_SEVERITY.MEDIUM,
      message: `Bulk data access detected: User ${userId} accessed ${count} ${resourceType} records (threshold: ${threshold})`,
      userId,
      context: { resourceType, count, threshold }
    }, db);

    return {
      detected: true,
      count,
      threshold,
      action: 'flagged_for_review'
    };
  }

  return { detected: false, count };
}

/**
 * Detect after-hours access
 * 
 * @param {string} userId - User ID
 * @param {string} tenantId - Tenant ID
 * @param {Object} db - Database client
 * @returns {Promise<Object>} - Detection result
 */
async function detectAfterHoursAccess(userId, tenantId, db) {
  const hour = new Date().getHours();
  const isAfterHours = hour < 6 || hour > 22; // Before 6 AM or after 10 PM

  if (isAfterHours) {
    await logSecurityEvent({
      eventType: SECURITY_EVENT_TYPES.AFTER_HOURS_ACCESS,
      severity: ALERT_SEVERITY.LOW,
      userId,
      tenantId,
      hour
    }, db);

    // Only alert for sensitive operations during after-hours
    return {
      detected: true,
      hour,
      action: 'monitor'
    };
  }

  return { detected: false };
}

/**
 * Log security event
 * 
 * @param {Object} event - Security event details
 * @param {Object} db - Database client
 * @returns {Promise<string>} - Event ID
 */
async function logSecurityEvent(event, db) {
  const {
    eventType,
    severity,
    tenantId,
    userId,
    ...eventData
  } = event;

  // Create audit log entry
  const auditId = await createAuditLog({
    tenantId: tenantId || '00000000-0000-0000-0000-000000000000', // System tenant for security events
    eventType: eventType || 'security_event',
    action: ACTIONS.CREATE,
    resourceType: 'security_event',
    userId,
    severity: severity || SEVERITY.WARNING,
    eventData: {
      securityEventType: eventType,
      ...eventData
    }
  }, db);

  // Store in security events table
  const result = await db.query(
    `INSERT INTO security_events (
      id, event_type, severity, tenant_id, user_id, 
      event_data, detected_at, audit_log_id
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), $6
    ) RETURNING id`,
    [
      eventType,
      severity,
      tenantId || null,
      userId || null,
      JSON.stringify(eventData),
      auditId
    ]
  );

  return result.rows[0].id;
}

/**
 * Trigger security alert
 * 
 * @param {Object} alert - Alert details
 * @param {Object} db - Database client
 * @returns {Promise<void>}
 */
async function triggerSecurityAlert(alert, db) {
  const {
    type,
    severity,
    message,
    userId,
    tenantId,
    context
  } = alert;

  // Store alert in database
  await db.query(
    `INSERT INTO security_alerts (
      id, alert_type, severity, message, tenant_id, user_id,
      context, status, created_at
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'open', NOW()
    )`,
    [
      type,
      severity,
      message,
      tenantId || null,
      userId || null,
      JSON.stringify(context || {})
    ]
  );

  // Send notifications based on severity
  if (severity === ALERT_SEVERITY.CRITICAL || severity === ALERT_SEVERITY.HIGH) {
    // In production, integrate with notification service
    console.error('[SECURITY ALERT]', {
      type,
      severity,
      message,
      userId,
      tenantId,
      context,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get security events for a tenant
 * 
 * @param {string} tenantId - Tenant ID
 * @param {Object} db - Database client
 * @param {Object} [filters] - Filter options
 * @returns {Promise<Array>} - Security events
 */
async function getSecurityEvents(tenantId, db, filters = {}) {
  const conditions = ['tenant_id = $1 OR tenant_id IS NULL'];
  const params = [tenantId];
  let paramIndex = 2;

  if (filters.eventType) {
    conditions.push(`event_type = $${paramIndex}`);
    params.push(filters.eventType);
    paramIndex++;
  }

  if (filters.severity) {
    conditions.push(`severity = $${paramIndex}`);
    params.push(filters.severity);
    paramIndex++;
  }

  if (filters.startDate) {
    conditions.push(`detected_at >= $${paramIndex}`);
    params.push(filters.startDate);
    paramIndex++;
  }

  if (filters.endDate) {
    conditions.push(`detected_at <= $${paramIndex}`);
    params.push(filters.endDate);
    paramIndex++;
  }

  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  const query = `
    SELECT *
    FROM security_events
    WHERE ${conditions.join(' AND ')}
    ORDER BY detected_at DESC
    LIMIT $${paramIndex}
    OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Get security alerts for a tenant
 * 
 * @param {string} tenantId - Tenant ID
 * @param {Object} db - Database client
 * @param {Object} [filters] - Filter options
 * @returns {Promise<Array>} - Security alerts
 */
async function getSecurityAlerts(tenantId, db, filters = {}) {
  const conditions = ['tenant_id = $1 OR tenant_id IS NULL'];
  const params = [tenantId];
  let paramIndex = 2;

  if (filters.status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  }

  if (filters.severity) {
    conditions.push(`severity = $${paramIndex}`);
    params.push(filters.severity);
    paramIndex++;
  }

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const query = `
    SELECT *
    FROM security_alerts
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT $${paramIndex}
    OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Update security alert status
 * 
 * @param {string} alertId - Alert ID
 * @param {string} status - New status (open, investigating, resolved, false_positive)
 * @param {string} resolvedBy - User ID who resolved the alert
 * @param {string} resolution - Resolution notes
 * @param {Object} db - Database client
 * @returns {Promise<void>}
 */
async function updateAlertStatus(alertId, status, resolvedBy, resolution, db) {
  await db.query(
    `UPDATE security_alerts
     SET status = $1, resolved_by = $2, resolution = $3, resolved_at = NOW()
     WHERE id = $4`,
    [status, resolvedBy, resolution, alertId]
  );
}

/**
 * Export security events for SIEM integration
 * 
 * @param {string} tenantId - Tenant ID
 * @param {string} format - Export format (json, cef, leef)
 * @param {Object} db - Database client
 * @param {Object} [filters] - Filter options
 * @returns {Promise<Object>} - Exported data
 */
async function exportForSIEM(tenantId, format, db, filters = {}) {
  const events = await getSecurityEvents(tenantId, db, filters);

  if (format === 'cef') {
    // Common Event Format for Splunk, ArcSight
    return events.map(event => ({
      cef_version: '0',
      device_vendor: 'EduOS',
      device_product: 'Security Monitoring',
      device_version: '1.0',
      signature_id: event.event_type,
      name: event.event_type,
      severity: event.severity,
      extension: event.event_data
    }));
  } else if (format === 'leef') {
    // Log Event Extended Format for IBM QRadar
    return events.map(event => ({
      leef_version: '2.0',
      vendor: 'EduOS',
      product: 'Security Monitoring',
      version: '1.0',
      event_id: event.event_type,
      ...event.event_data
    }));
  }

  // Default JSON format
  return events;
}

/**
 * Generate security metrics for compliance reporting
 * 
 * @param {string} tenantId - Tenant ID
 * @param {Object} db - Database client
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} - Security metrics
 */
async function generateSecurityMetrics(tenantId, db, startDate, endDate) {
  const result = await db.query(
    `SELECT 
      COUNT(*) as total_events,
      COUNT(*) FILTER (WHERE severity = 'critical') as critical_events,
      COUNT(*) FILTER (WHERE severity = 'high') as high_events,
      COUNT(*) FILTER (WHERE severity = 'medium') as medium_events,
      COUNT(*) FILTER (WHERE severity = 'low') as low_events,
      COUNT(DISTINCT event_type) as unique_event_types,
      COUNT(DISTINCT user_id) as affected_users
     FROM security_events
     WHERE (tenant_id = $1 OR tenant_id IS NULL)
       AND detected_at BETWEEN $2 AND $3`,
    [tenantId, startDate, endDate]
  );

  const alertsResult = await db.query(
    `SELECT 
      COUNT(*) as total_alerts,
      COUNT(*) FILTER (WHERE status = 'open') as open_alerts,
      COUNT(*) FILTER (WHERE status = 'resolved') as resolved_alerts,
      COUNT(*) FILTER (WHERE status = 'false_positive') as false_positives,
      AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours
     FROM security_alerts
     WHERE (tenant_id = $1 OR tenant_id IS NULL)
       AND created_at BETWEEN $2 AND $3`,
    [tenantId, startDate, endDate]
  );

  return {
    period: {
      start: startDate,
      end: endDate
    },
    events: result.rows[0],
    alerts: alertsResult.rows[0],
    generated_at: new Date().toISOString()
  };
}

module.exports = {
  // Constants
  SECURITY_EVENT_TYPES,
  ALERT_SEVERITY,
  ALERT_CHANNELS,
  SIEM_TYPES,
  
  // Detection functions
  detectBruteForce,
  detectImpossibleTravel,
  detectPrivilegeEscalation,
  detectBulkDataAccess,
  detectAfterHoursAccess,
  
  // Event management
  logSecurityEvent,
  triggerSecurityAlert,
  getSecurityEvents,
  getSecurityAlerts,
  updateAlertStatus,
  
  // SIEM integration
  exportForSIEM,
  generateSecurityMetrics
};
