/**
 * Audit Dashboard Routes
 * 
 * API endpoints for audit dashboard, analytics, and compliance reporting
 * 
 * Features:
 * - Dashboard summary with recent activity
 * - Top users analytics
 * - Suspicious event detection
 * - Anomaly detection
 * - Compliance reports (GDPR, FERPA)
 * - Real-time alert configuration
 */

const express = require('express');
const router = express.Router();
const auditDashboardService = require('../services/auditDashboardService');
const auditService = require('../services/auditService');
const { Pool } = require('pg');

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'eduos',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

/**
 * Middleware to check if user has audit dashboard access
 * Only authorized roles can view audit logs
 */
function checkAuditAccess(req, res, next) {
  // In production, this should check actual user roles from JWT token
  // For now, we'll check if a role is provided in headers
  const userRole = req.headers['x-user-role'];
  
  const authorizedRoles = ['superadmin', 'admin', 'auditor', 'compliance_officer'];
  
  if (!userRole || !authorizedRoles.includes(userRole.toLowerCase())) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Only authorized users can access audit dashboard',
      required_roles: authorizedRoles,
    });
  }
  
  next();
}

/**
 * GET /api/v1/audit-dashboard/summary
 * Get dashboard summary with key metrics
 * 
 * Query parameters:
 * - tenant_id (required): Tenant ID
 * - hours (optional): Number of hours to look back (default: 24)
 */
router.get('/summary', checkAuditAccess, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id, hours } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required parameter: tenant_id',
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    const summary = await auditDashboardService.getDashboardSummary(
      tenant_id,
      client,
      { hours: hours ? parseInt(hours) : 24 }
    );

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('Error getting dashboard summary:', error);
    res.status(500).json({
      error: 'Failed to get dashboard summary',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/v1/audit-dashboard/recent-activity
 * Get recent activity
 * 
 * Query parameters:
 * - tenant_id (required): Tenant ID
 * - limit (optional): Limit number of results (default: 50)
 * - hours (optional): Number of hours to look back (default: 24)
 */
router.get('/recent-activity', checkAuditAccess, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id, limit, hours } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required parameter: tenant_id',
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    const activity = await auditDashboardService.getRecentActivity(
      tenant_id,
      client,
      {
        limit: limit ? parseInt(limit) : 50,
        hours: hours ? parseInt(hours) : 24,
      }
    );

    res.json({
      success: true,
      activity,
    });
  } catch (error) {
    console.error('Error getting recent activity:', error);
    res.status(500).json({
      error: 'Failed to get recent activity',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/v1/audit-dashboard/top-users
 * Get top users by activity
 * 
 * Query parameters:
 * - tenant_id (required): Tenant ID
 * - limit (optional): Limit number of results (default: 10)
 * - hours (optional): Number of hours to look back (default: 24)
 */
router.get('/top-users', checkAuditAccess, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id, limit, hours } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required parameter: tenant_id',
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    const topUsers = await auditDashboardService.getTopUsers(
      tenant_id,
      client,
      {
        limit: limit ? parseInt(limit) : 10,
        hours: hours ? parseInt(hours) : 24,
      }
    );

    res.json({
      success: true,
      top_users: topUsers,
    });
  } catch (error) {
    console.error('Error getting top users:', error);
    res.status(500).json({
      error: 'Failed to get top users',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/v1/audit-dashboard/suspicious-events
 * Detect suspicious events
 * 
 * Query parameters:
 * - tenant_id (required): Tenant ID
 * - hours (optional): Number of hours to look back (default: 24)
 */
router.get('/suspicious-events', checkAuditAccess, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id, hours } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required parameter: tenant_id',
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    const suspiciousEvents = await auditDashboardService.detectSuspiciousEvents(
      tenant_id,
      client,
      { hours: hours ? parseInt(hours) : 24 }
    );

    // Log the detection action
    await auditService.createAuditLog({
      tenantId: tenant_id,
      eventType: 'suspicious_event_detection',
      action: 'read',
      resourceType: 'audit_dashboard',
      userId: req.headers['x-user-id'] || null,
      eventData: {
        suspicious_count: suspiciousEvents.length,
        hours: hours ? parseInt(hours) : 24,
      },
    }, client);

    res.json({
      success: true,
      suspicious_events: suspiciousEvents,
      total: suspiciousEvents.length,
    });
  } catch (error) {
    console.error('Error detecting suspicious events:', error);
    res.status(500).json({
      error: 'Failed to detect suspicious events',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/v1/audit-dashboard/anomalies
 * Detect anomalies in access patterns
 * 
 * Query parameters:
 * - tenant_id (required): Tenant ID
 * - hours (optional): Number of hours to look back (default: 24)
 */
router.get('/anomalies', checkAuditAccess, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id, hours } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required parameter: tenant_id',
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    const anomalies = await auditDashboardService.detectAnomalies(
      tenant_id,
      client,
      { hours: hours ? parseInt(hours) : 24 }
    );

    // Log the detection action
    await auditService.createAuditLog({
      tenantId: tenant_id,
      eventType: 'anomaly_detection',
      action: 'read',
      resourceType: 'audit_dashboard',
      userId: req.headers['x-user-id'] || null,
      eventData: {
        anomaly_count: anomalies.length,
        hours: hours ? parseInt(hours) : 24,
      },
    }, client);

    res.json({
      success: true,
      anomalies,
      total: anomalies.length,
    });
  } catch (error) {
    console.error('Error detecting anomalies:', error);
    res.status(500).json({
      error: 'Failed to detect anomalies',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/v1/audit-dashboard/reports/gdpr
 * Generate GDPR compliance report
 * 
 * Request body:
 * - tenant_id (required): Tenant ID
 * - start_date (optional): Start date (ISO 8601)
 * - end_date (optional): End date (ISO 8601)
 */
router.post('/reports/gdpr', checkAuditAccess, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id, start_date, end_date } = req.body;

    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required field: tenant_id',
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    const report = await auditDashboardService.generateGDPRReport(
      tenant_id,
      client,
      {
        startDate: start_date ? new Date(start_date) : undefined,
        endDate: end_date ? new Date(end_date) : undefined,
      }
    );

    // Log the report generation
    await auditService.createAuditLog({
      tenantId: tenant_id,
      eventType: 'compliance_report_generated',
      action: 'create',
      resourceType: 'gdpr_report',
      userId: req.body.generated_by_user_id || null,
      eventData: {
        report_type: 'GDPR',
        period: report.period,
      },
    }, client);

    res.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Error generating GDPR report:', error);
    res.status(500).json({
      error: 'Failed to generate GDPR report',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/v1/audit-dashboard/reports/ferpa
 * Generate FERPA compliance report
 * 
 * Request body:
 * - tenant_id (required): Tenant ID
 * - start_date (optional): Start date (ISO 8601)
 * - end_date (optional): End date (ISO 8601)
 */
router.post('/reports/ferpa', checkAuditAccess, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id, start_date, end_date } = req.body;

    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required field: tenant_id',
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    const report = await auditDashboardService.generateFERPAReport(
      tenant_id,
      client,
      {
        startDate: start_date ? new Date(start_date) : undefined,
        endDate: end_date ? new Date(end_date) : undefined,
      }
    );

    // Log the report generation
    await auditService.createAuditLog({
      tenantId: tenant_id,
      eventType: 'compliance_report_generated',
      action: 'create',
      resourceType: 'ferpa_report',
      userId: req.body.generated_by_user_id || null,
      eventData: {
        report_type: 'FERPA',
        period: report.period,
      },
    }, client);

    res.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Error generating FERPA report:', error);
    res.status(500).json({
      error: 'Failed to generate FERPA report',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/v1/audit-dashboard/alerts/configure
 * Configure real-time alerts
 * 
 * Request body:
 * - tenant_id (required): Tenant ID
 * - alert_type (required): Type of alert (failed_logins, bulk_operations, suspicious_access, etc.)
 * - threshold (required): Threshold for triggering alert
 * - notification_channels (required): Array of channels (email, sms, webhook)
 * - recipients (required): Array of recipient emails/phones
 * - enabled (optional): Whether alert is enabled (default: true)
 */
router.post('/alerts/configure', checkAuditAccess, async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      tenant_id,
      alert_type,
      threshold,
      notification_channels,
      recipients,
      enabled = true,
    } = req.body;

    // Validate required fields
    if (!tenant_id || !alert_type || !threshold || !notification_channels || !recipients) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['tenant_id', 'alert_type', 'threshold', 'notification_channels', 'recipients'],
      });
    }

    // Validate alert type
    const validAlertTypes = [
      'failed_logins',
      'bulk_operations',
      'suspicious_access',
      'permission_escalation',
      'after_hours_access',
      'unusual_export_volume',
    ];

    if (!validAlertTypes.includes(alert_type)) {
      return res.status(400).json({
        error: 'Invalid alert type',
        valid_types: validAlertTypes,
      });
    }

    // Validate notification channels
    const validChannels = ['email', 'sms', 'webhook'];
    const invalidChannels = notification_channels.filter(c => !validChannels.includes(c));
    
    if (invalidChannels.length > 0) {
      return res.status(400).json({
        error: 'Invalid notification channels',
        invalid: invalidChannels,
        valid_channels: validChannels,
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    // Store alert configuration (in production, this would be in a dedicated table)
    const alertConfig = {
      id: `alert-${Date.now()}`,
      tenant_id,
      alert_type,
      threshold,
      notification_channels,
      recipients,
      enabled,
      created_at: new Date().toISOString(),
    };

    // Log the alert configuration
    await auditService.createAuditLog({
      tenantId: tenant_id,
      eventType: auditService.EVENT_TYPES.SYSTEM_CONFIG_CHANGED,
      action: auditService.ACTIONS.CREATE,
      resourceType: 'alert_configuration',
      resourceId: alertConfig.id,
      userId: req.body.configured_by_user_id || null,
      eventData: alertConfig,
    }, client);

    res.json({
      success: true,
      alert_config: alertConfig,
      message: 'Alert configuration saved successfully',
    });
  } catch (error) {
    console.error('Error configuring alert:', error);
    res.status(500).json({
      error: 'Failed to configure alert',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/v1/audit-dashboard/alerts/list
 * List configured alerts for a tenant
 * 
 * Query parameters:
 * - tenant_id (required): Tenant ID
 */
router.get('/alerts/list', checkAuditAccess, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required parameter: tenant_id',
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    // In production, this would query a dedicated alerts table
    // For now, we'll return the alert types that can be configured
    const availableAlerts = [
      {
        alert_type: 'failed_logins',
        description: 'Alert when multiple failed login attempts detected',
        default_threshold: 5,
        recommended_channels: ['email', 'sms'],
      },
      {
        alert_type: 'bulk_operations',
        description: 'Alert when bulk operations are performed',
        default_threshold: 1,
        recommended_channels: ['email'],
      },
      {
        alert_type: 'suspicious_access',
        description: 'Alert when suspicious access patterns detected',
        default_threshold: 1,
        recommended_channels: ['email', 'sms'],
      },
      {
        alert_type: 'permission_escalation',
        description: 'Alert when permission escalation attempts detected',
        default_threshold: 3,
        recommended_channels: ['email', 'sms', 'webhook'],
      },
      {
        alert_type: 'after_hours_access',
        description: 'Alert when users access system outside business hours',
        default_threshold: 5,
        recommended_channels: ['email'],
      },
      {
        alert_type: 'unusual_export_volume',
        description: 'Alert when unusual data export volume detected',
        default_threshold: 5,
        recommended_channels: ['email', 'sms'],
      },
    ];

    res.json({
      success: true,
      available_alerts: availableAlerts,
      message: 'Use POST /api/v1/audit-dashboard/alerts/configure to configure alerts',
    });
  } catch (error) {
    console.error('Error listing alerts:', error);
    res.status(500).json({
      error: 'Failed to list alerts',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

module.exports = router;
