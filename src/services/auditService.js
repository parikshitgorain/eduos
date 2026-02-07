/**
 * Audit Service
 * 
 * Provides tamper-evident audit logging with SHA-256 hash chain.
 * All audit entries are immutable and cryptographically linked.
 * 
 * Features:
 * - Tamper-evident hash chain
 * - Immutable audit entries
 * - Comprehensive event logging
 * - Integrity verification
 * - Retention policy management
 */

const crypto = require('crypto');

/**
 * Event types for audit logging
 */
const EVENT_TYPES = {
  // Authentication events
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  LOGIN_FAILED: 'login_failed',
  PASSWORD_RESET: 'password_reset',
  MFA_ENABLED: 'mfa_enabled',
  MFA_DISABLED: 'mfa_disabled',
  
  // Data access events
  DATA_ACCESS: 'data_access',
  DATA_EXPORT: 'data_export',
  BULK_EXPORT: 'bulk_export',
  
  // Data modification events
  DATA_MODIFICATION: 'data_modification',
  BULK_MODIFICATION: 'bulk_modification',
  DATA_DELETION: 'data_deletion',
  BULK_DELETION: 'bulk_deletion',
  
  // Permission events
  PERMISSION_GRANTED: 'permission_granted',
  PERMISSION_REVOKED: 'permission_revoked',
  ROLE_ASSIGNED: 'role_assigned',
  ROLE_REMOVED: 'role_removed',
  
  // Schema events
  SCHEMA_CREATED: 'schema_created',
  SCHEMA_MODIFIED: 'schema_modified',
  SCHEMA_MIGRATION: 'schema_migration',
  
  // Merge events
  STUDENT_MERGED: 'student_merged',
  MERGE_REVERSED: 'merge_reversed',
  
  // Payment events
  PAYMENT_CREATED: 'payment_created',
  PAYMENT_CAPTURED: 'payment_captured',
  REFUND_REQUESTED: 'refund_requested',
  REFUND_APPROVED: 'refund_approved',
  REFUND_PROCESSED: 'refund_processed',
  
  // System events
  SYSTEM_CONFIG_CHANGED: 'system_config_changed',
  TENANT_CREATED: 'tenant_created',
  TENANT_SUSPENDED: 'tenant_suspended',
  AI_KILL_SWITCH_ACTIVATED: 'ai_kill_switch_activated',
  AI_KILL_SWITCH_DEACTIVATED: 'ai_kill_switch_deactivated'
};

/**
 * Actions for audit logging
 */
const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  LOGIN: 'login',
  LOGOUT: 'logout',
  GRANT: 'grant',
  REVOKE: 'revoke',
  APPROVE: 'approve',
  REJECT: 'reject',
  EXPORT: 'export',
  IMPORT: 'import'
};

/**
 * Severity levels
 */
const SEVERITY = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * Create an audit log entry
 * 
 * @param {Object} params - Audit log parameters
 * @param {string} params.tenantId - Tenant ID
 * @param {string} params.eventType - Event type (from EVENT_TYPES)
 * @param {string} params.action - Action performed (from ACTIONS)
 * @param {string} [params.resourceType] - Type of resource affected
 * @param {string} [params.resourceId] - ID of resource affected
 * @param {string} [params.userId] - User who performed the action
 * @param {string} [params.userEmail] - Email of user
 * @param {string} [params.userRole] - Role of user
 * @param {string} [params.ipAddress] - IP address of request
 * @param {string} [params.userAgent] - User agent string
 * @param {string} [params.requestId] - Request ID for correlation
 * @param {string} [params.sessionId] - Session ID
 * @param {Object} [params.eventData] - Additional event data
 * @param {Object} [params.oldValues] - Previous values (for updates)
 * @param {Object} [params.newValues] - New values (for updates)
 * @param {string} [params.severity] - Severity level (default: 'info')
 * @param {string} [params.status] - Status (default: 'success')
 * @param {string} [params.errorMessage] - Error message (if status is 'failure')
 * @param {Object} db - Database client
 * @returns {Promise<string>} - Audit log entry ID
 */
async function createAuditLog(params, db) {
  if (!db) {
    throw new Error('Database client is required');
  }

  if (!params.tenantId) {
    throw new Error('Tenant ID is required');
  }

  if (!params.eventType) {
    throw new Error('Event type is required');
  }

  if (!params.action) {
    throw new Error('Action is required');
  }

  const result = await db.query(
    `SELECT create_audit_log(
      $1::UUID, $2, $3, $4, $5::UUID, $6::UUID, $7, $8, $9::INET, $10,
      $11::UUID, $12::UUID, $13::JSONB, $14::JSONB, $15::JSONB,
      $16, $17, $18
    ) AS id`,
    [
      params.tenantId,
      params.eventType,
      params.action,
      params.resourceType || null,
      params.resourceId || null,
      params.userId || null,
      params.userEmail || null,
      params.userRole || null,
      params.ipAddress || null,
      params.userAgent || null,
      params.requestId || null,
      params.sessionId || null,
      JSON.stringify(params.eventData || {}),
      params.oldValues ? JSON.stringify(params.oldValues) : null,
      params.newValues ? JSON.stringify(params.newValues) : null,
      params.severity || SEVERITY.INFO,
      params.status || 'success',
      params.errorMessage || null
    ]
  );

  return result.rows[0].id;
}

/**
 * Get audit logs for a tenant
 * 
 * @param {string} tenantId - Tenant ID
 * @param {Object} db - Database client
 * @param {Object} [filters] - Filter options
 * @param {string} [filters.userId] - Filter by user ID
 * @param {string} [filters.eventType] - Filter by event type
 * @param {string} [filters.action] - Filter by action
 * @param {string} [filters.resourceType] - Filter by resource type
 * @param {string} [filters.resourceId] - Filter by resource ID
 * @param {Date} [filters.startDate] - Filter by start date
 * @param {Date} [filters.endDate] - Filter by end date
 * @param {string} [filters.severity] - Filter by severity
 * @param {number} [filters.limit] - Limit number of results (default: 100)
 * @param {number} [filters.offset] - Offset for pagination (default: 0)
 * @returns {Promise<Array>} - Array of audit log entries
 */
async function getAuditLogs(tenantId, db, filters = {}) {
  if (!db) {
    throw new Error('Database client is required');
  }

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const conditions = ['tenant_id = $1'];
  const params = [tenantId];
  let paramIndex = 2;

  if (filters.userId) {
    conditions.push(`user_id = $${paramIndex}`);
    params.push(filters.userId);
    paramIndex++;
  }

  if (filters.eventType) {
    conditions.push(`event_type = $${paramIndex}`);
    params.push(filters.eventType);
    paramIndex++;
  }

  if (filters.action) {
    conditions.push(`action = $${paramIndex}`);
    params.push(filters.action);
    paramIndex++;
  }

  if (filters.resourceType) {
    conditions.push(`resource_type = $${paramIndex}`);
    params.push(filters.resourceType);
    paramIndex++;
  }

  if (filters.resourceId) {
    conditions.push(`resource_id = $${paramIndex}`);
    params.push(filters.resourceId);
    paramIndex++;
  }

  if (filters.startDate) {
    conditions.push(`created_at >= $${paramIndex}`);
    params.push(filters.startDate);
    paramIndex++;
  }

  if (filters.endDate) {
    conditions.push(`created_at <= $${paramIndex}`);
    params.push(filters.endDate);
    paramIndex++;
  }

  if (filters.severity) {
    conditions.push(`severity = $${paramIndex}`);
    params.push(filters.severity);
    paramIndex++;
  }

  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  const query = `
    SELECT *
    FROM audit_logs
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC, id DESC
    LIMIT $${paramIndex}
    OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Get a single audit log entry by ID
 * 
 * @param {string} id - Audit log entry ID
 * @param {string} tenantId - Tenant ID
 * @param {Object} db - Database client
 * @returns {Promise<Object|null>} - Audit log entry or null if not found
 */
async function getAuditLogById(id, tenantId, db) {
  if (!db) {
    throw new Error('Database client is required');
  }

  if (!id) {
    throw new Error('Audit log ID is required');
  }

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const result = await db.query(
    'SELECT * FROM audit_logs WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );

  return result.rows[0] || null;
}

/**
 * Verify audit log integrity for a tenant
 * 
 * @param {string} tenantId - Tenant ID
 * @param {Object} db - Database client
 * @param {Object} [options] - Verification options
 * @param {Date} [options.startDate] - Start date for verification
 * @param {Date} [options.endDate] - End date for verification
 * @returns {Promise<Object>} - Verification result
 */
async function verifyAuditIntegrity(tenantId, db, options = {}) {
  if (!db) {
    throw new Error('Database client is required');
  }

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const result = await db.query(
    'SELECT * FROM verify_audit_chain($1::UUID, $2, $3)',
    [tenantId, options.startDate || null, options.endDate || null]
  );

  return result.rows[0];
}

/**
 * Set retention policy for a tenant
 * 
 * @param {string} tenantId - Tenant ID
 * @param {string} tier - Tenant tier (basic, business, enterprise)
 * @param {Object} db - Database client
 * @returns {Promise<void>}
 */
async function setRetentionPolicy(tenantId, tier, db) {
  if (!db) {
    throw new Error('Database client is required');
  }

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  if (!tier) {
    throw new Error('Tier is required');
  }

  await db.query(
    'SELECT set_audit_retention_policy($1::UUID, $2)',
    [tenantId, tier]
  );
}

/**
 * Get retention policy for a tenant
 * 
 * @param {string} tenantId - Tenant ID
 * @param {Object} db - Database client
 * @returns {Promise<Object|null>} - Retention policy or null if not found
 */
async function getRetentionPolicy(tenantId, db) {
  if (!db) {
    throw new Error('Database client is required');
  }

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const result = await db.query(
    'SELECT * FROM audit_retention_policies WHERE tenant_id = $1',
    [tenantId]
  );

  return result.rows[0] || null;
}

/**
 * Export audit logs with digital signature
 * 
 * @param {string} tenantId - Tenant ID
 * @param {Object} db - Database client
 * @param {Object} [filters] - Filter options (same as getAuditLogs)
 * @returns {Promise<Object>} - Export data with signature
 */
async function exportAuditLogs(tenantId, db, filters = {}) {
  if (!db) {
    throw new Error('Database client is required');
  }

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  // Get audit logs
  const logs = await getAuditLogs(tenantId, db, { ...filters, limit: 10000 });

  // Verify integrity before export
  const verification = await verifyAuditIntegrity(tenantId, db, {
    startDate: filters.startDate,
    endDate: filters.endDate
  });

  // Create export data
  const exportData = {
    tenant_id: tenantId,
    export_date: new Date().toISOString(),
    total_entries: logs.length,
    integrity_verified: verification.is_valid,
    filters: filters,
    logs: logs
  };

  // Generate digital signature (SHA-256 hash of export data)
  const exportJson = JSON.stringify(exportData);
  const signature = crypto.createHash('sha256').update(exportJson).digest('hex');

  return {
    ...exportData,
    signature: signature
  };
}

/**
 * Helper function to extract user context from request
 * 
 * @param {Object} req - Express request object
 * @returns {Object} - User context
 */
function extractUserContext(req) {
  return {
    userId: req.user?.id || null,
    userEmail: req.user?.email || null,
    userRole: req.user?.role || null,
    ipAddress: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.get('user-agent') || null,
    requestId: req.id || null,
    sessionId: req.session?.id || null
  };
}

module.exports = {
  // Constants
  EVENT_TYPES,
  ACTIONS,
  SEVERITY,
  
  // Functions
  createAuditLog,
  getAuditLogs,
  getAuditLogById,
  verifyAuditIntegrity,
  setRetentionPolicy,
  getRetentionPolicy,
  exportAuditLogs,
  extractUserContext
};
