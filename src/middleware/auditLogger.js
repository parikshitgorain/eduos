/**
 * Audit Logger Middleware
 * 
 * Automatically logs HTTP requests and responses to the audit log
 * 
 * Features:
 * - Logs all API requests
 * - Captures user context
 * - Records request/response details
 * - Handles errors
 */

const auditService = require('../services/auditService');

/**
 * Audit logger middleware
 * 
 * Logs API requests to the audit log system
 */
function auditLogger(options = {}) {
  const {
    excludePaths = ['/health', '/metrics'],
    logSuccessOnly = false,
  } = options;

  return async (req, res, next) => {
    // Skip excluded paths
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Capture start time
    const startTime = Date.now();

    // Store original end function
    const originalEnd = res.end;

    // Override end function to capture response
    res.end = function (chunk, encoding) {
      // Restore original end function
      res.end = originalEnd;

      // Call original end function
      res.end(chunk, encoding);

      // Calculate response time
      const responseTime = Date.now() - startTime;

      // Determine if we should log this request
      const shouldLog = !logSuccessOnly || (res.statusCode >= 200 && res.statusCode < 300);

      if (shouldLog && req.db) {
        // Extract user context
        const userContext = auditService.extractUserContext(req);

        // Determine event type based on method and path
        let eventType = auditService.EVENT_TYPES.DATA_ACCESS;
        let action = auditService.ACTIONS.READ;

        if (req.method === 'POST') {
          eventType = auditService.EVENT_TYPES.DATA_MODIFICATION;
          action = auditService.ACTIONS.CREATE;
        } else if (req.method === 'PUT' || req.method === 'PATCH') {
          eventType = auditService.EVENT_TYPES.DATA_MODIFICATION;
          action = auditService.ACTIONS.UPDATE;
        } else if (req.method === 'DELETE') {
          eventType = auditService.EVENT_TYPES.DATA_MODIFICATION;
          action = auditService.ACTIONS.DELETE;
        }

        // Determine resource type from path
        const pathParts = req.path.split('/').filter(Boolean);
        const resourceType = pathParts[pathParts.length - 1] || 'unknown';

        // Log to audit system (async, don't wait)
        auditService.createAuditLog({
          tenantId: req.tenantId || req.body?.tenant_id || req.query?.tenant_id,
          eventType,
          action,
          resourceType,
          resourceId: req.params?.id || null,
          userId: userContext.userId,
          userEmail: userContext.userEmail,
          userRole: userContext.userRole,
          ipAddress: userContext.ipAddress,
          userAgent: userContext.userAgent,
          requestId: userContext.requestId,
          sessionId: userContext.sessionId,
          eventData: {
            method: req.method,
            path: req.path,
            query: req.query,
            status_code: res.statusCode,
            response_time_ms: responseTime,
          },
          severity: res.statusCode >= 500 ? auditService.SEVERITY.ERROR :
                   res.statusCode >= 400 ? auditService.SEVERITY.WARNING :
                   auditService.SEVERITY.INFO,
          status: res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'failure',
        }, req.db).catch(err => {
          console.error('Failed to create audit log:', err);
        });
      }
    };

    next();
  };
}

/**
 * Create audit log for specific events
 * 
 * Helper function to manually log specific events
 */
async function logEvent(params, db) {
  try {
    await auditService.createAuditLog(params, db);
  } catch (error) {
    console.error('Failed to log event:', error);
  }
}

/**
 * Log login event
 */
async function logLogin(userId, userEmail, tenantId, success, ipAddress, userAgent, db) {
  await logEvent({
    tenantId,
    eventType: success ? auditService.EVENT_TYPES.USER_LOGIN : auditService.EVENT_TYPES.LOGIN_FAILED,
    action: auditService.ACTIONS.LOGIN,
    userId: success ? userId : null,
    userEmail,
    ipAddress,
    userAgent,
    eventData: {
      success,
    },
    severity: success ? auditService.SEVERITY.INFO : auditService.SEVERITY.WARNING,
    status: success ? 'success' : 'failure',
    errorMessage: success ? null : 'Invalid credentials',
  }, db);
}

/**
 * Log logout event
 */
async function logLogout(userId, userEmail, tenantId, ipAddress, userAgent, db) {
  await logEvent({
    tenantId,
    eventType: auditService.EVENT_TYPES.USER_LOGOUT,
    action: auditService.ACTIONS.LOGOUT,
    userId,
    userEmail,
    ipAddress,
    userAgent,
    eventData: {},
    severity: auditService.SEVERITY.INFO,
    status: 'success',
  }, db);
}

/**
 * Log data access event
 */
async function logDataAccess(params, db) {
  await logEvent({
    ...params,
    eventType: auditService.EVENT_TYPES.DATA_ACCESS,
    action: auditService.ACTIONS.READ,
    severity: auditService.SEVERITY.INFO,
    status: 'success',
  }, db);
}

/**
 * Log data modification event
 */
async function logDataModification(params, db) {
  await logEvent({
    ...params,
    eventType: auditService.EVENT_TYPES.DATA_MODIFICATION,
    severity: auditService.SEVERITY.INFO,
    status: 'success',
  }, db);
}

/**
 * Log permission change event
 */
async function logPermissionChange(params, db) {
  await logEvent({
    ...params,
    eventType: params.action === auditService.ACTIONS.GRANT ?
      auditService.EVENT_TYPES.PERMISSION_GRANTED :
      auditService.EVENT_TYPES.PERMISSION_REVOKED,
    severity: auditService.SEVERITY.INFO,
    status: 'success',
  }, db);
}

module.exports = {
  auditLogger,
  logEvent,
  logLogin,
  logLogout,
  logDataAccess,
  logDataModification,
  logPermissionChange,
};
