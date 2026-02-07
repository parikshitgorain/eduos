/**
 * Audit Log Routes
 * 
 * API endpoints for audit log search, retrieval, and export
 * 
 * Features:
 * - Search audit logs with filters
 * - Export audit logs with digital signature
 * - Verify audit log integrity
 * - Get retention policies
 */

const express = require('express');
const router = express.Router();
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
 * GET /api/v1/audit-logs
 * Search audit logs with filters
 * 
 * Query parameters:
 * - tenant_id (required): Tenant ID
 * - user_id (optional): Filter by user ID
 * - event_type (optional): Filter by event type
 * - action (optional): Filter by action
 * - resource_type (optional): Filter by resource type
 * - resource_id (optional): Filter by resource ID
 * - start_date (optional): Filter by start date (ISO 8601)
 * - end_date (optional): Filter by end date (ISO 8601)
 * - severity (optional): Filter by severity
 * - limit (optional): Limit number of results (default: 100, max: 1000)
 * - offset (optional): Offset for pagination (default: 0)
 */
router.get('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      tenant_id,
      user_id,
      event_type,
      action,
      resource_type,
      resource_id,
      start_date,
      end_date,
      severity,
      limit,
      offset,
    } = req.query;

    // Validate required fields
    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required parameter: tenant_id',
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    // Build filters
    const filters = {};
    if (user_id) filters.userId = user_id;
    if (event_type) filters.eventType = event_type;
    if (action) filters.action = action;
    if (resource_type) filters.resourceType = resource_type;
    if (resource_id) filters.resourceId = resource_id;
    if (start_date) filters.startDate = new Date(start_date);
    if (end_date) filters.endDate = new Date(end_date);
    if (severity) filters.severity = severity;
    if (limit) filters.limit = Math.min(parseInt(limit), 1000);
    if (offset) filters.offset = parseInt(offset);

    // Get audit logs
    const logs = await auditService.getAuditLogs(tenant_id, client, filters);

    // Get total count for pagination
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM audit_logs WHERE tenant_id = $1`,
      [tenant_id]
    );
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit: filters.limit || 100,
        offset: filters.offset || 0,
        has_more: (filters.offset || 0) + logs.length < total,
      },
    });
  } catch (error) {
    console.error('Error searching audit logs:', error);
    res.status(500).json({
      error: 'Failed to search audit logs',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/v1/audit-logs/event-types
 * Get list of available event types
 */
router.get('/event-types', (req, res) => {
  res.json({
    success: true,
    event_types: Object.values(auditService.EVENT_TYPES),
  });
});

/**
 * GET /api/v1/audit-logs/actions
 * Get list of available actions
 */
router.get('/actions', (req, res) => {
  res.json({
    success: true,
    actions: Object.values(auditService.ACTIONS),
  });
});

/**
 * GET /api/v1/audit-logs/retention-policy
 * Get retention policy for a tenant
 */
router.get('/retention-policy', async (req, res) => {
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

    const policy = await auditService.getRetentionPolicy(tenant_id, client);

    if (!policy) {
      return res.status(404).json({
        error: 'Retention policy not found',
      });
    }

    res.json({
      success: true,
      policy,
    });
  } catch (error) {
    console.error('Error getting retention policy:', error);
    res.status(500).json({
      error: 'Failed to get retention policy',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/v1/audit-logs/:id
 * Get a single audit log entry by ID
 */
router.get('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required parameter: tenant_id',
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    const log = await auditService.getAuditLogById(id, tenant_id, client);

    if (!log) {
      return res.status(404).json({
        error: 'Audit log entry not found',
      });
    }

    res.json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error('Error getting audit log:', error);
    res.status(500).json({
      error: 'Failed to get audit log',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/v1/audit-logs/export
 * Export audit logs with digital signature
 * 
 * Request body:
 * - tenant_id (required): Tenant ID
 * - user_id (optional): Filter by user ID
 * - event_type (optional): Filter by event type
 * - action (optional): Filter by action
 * - resource_type (optional): Filter by resource type
 * - resource_id (optional): Filter by resource ID
 * - start_date (optional): Filter by start date (ISO 8601)
 * - end_date (optional): Filter by end date (ISO 8601)
 * - severity (optional): Filter by severity
 */
router.post('/export', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      tenant_id,
      user_id,
      event_type,
      action,
      resource_type,
      resource_id,
      start_date,
      end_date,
      severity,
    } = req.body;

    // Validate required fields
    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required field: tenant_id',
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    // Build filters
    const filters = {};
    if (user_id) filters.userId = user_id;
    if (event_type) filters.eventType = event_type;
    if (action) filters.action = action;
    if (resource_type) filters.resourceType = resource_type;
    if (resource_id) filters.resourceId = resource_id;
    if (start_date) filters.startDate = new Date(start_date);
    if (end_date) filters.endDate = new Date(end_date);
    if (severity) filters.severity = severity;

    // Export audit logs with digital signature
    const exportData = await auditService.exportAuditLogs(tenant_id, client, filters);

    // Log the export action
    await auditService.createAuditLog({
      tenantId: tenant_id,
      eventType: auditService.EVENT_TYPES.DATA_EXPORT,
      action: auditService.ACTIONS.EXPORT,
      resourceType: 'audit_logs',
      userId: req.body.exported_by_user_id || null,
      eventData: {
        filters,
        total_entries: exportData.total_entries,
      },
    }, client);

    res.json({
      success: true,
      export: exportData,
    });
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({
      error: 'Failed to export audit logs',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/v1/audit-logs/verify
 * Verify audit log integrity
 * 
 * Request body:
 * - tenant_id (required): Tenant ID
 * - start_date (optional): Start date for verification (ISO 8601)
 * - end_date (optional): End date for verification (ISO 8601)
 */
router.post('/verify', async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id, start_date, end_date } = req.body;

    // Validate required fields
    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required field: tenant_id',
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    // Verify audit integrity
    const verification = await auditService.verifyAuditIntegrity(tenant_id, client, {
      startDate: start_date ? new Date(start_date) : null,
      endDate: end_date ? new Date(end_date) : null,
    });

    // Log the verification action
    await auditService.createAuditLog({
      tenantId: tenant_id,
      eventType: 'audit_verification',
      action: 'verify',
      resourceType: 'audit_logs',
      userId: req.body.verified_by_user_id || null,
      eventData: {
        verification_result: verification,
      },
      severity: verification.is_valid ? 'info' : 'critical',
    }, client);

    res.json({
      success: true,
      verification,
    });
  } catch (error) {
    console.error('Error verifying audit integrity:', error);
    res.status(500).json({
      error: 'Failed to verify audit integrity',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/v1/audit-logs/retention-policy
 * Set retention policy for a tenant
 * 
 * Request body:
 * - tenant_id (required): Tenant ID
 * - tier (required): Tenant tier (basic, business, enterprise)
 */
router.post('/retention-policy', async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id, tier } = req.body;

    // Validate required fields
    if (!tenant_id || !tier) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['tenant_id', 'tier'],
      });
    }

    // Validate tier
    if (!['basic', 'business', 'enterprise'].includes(tier)) {
      return res.status(400).json({
        error: 'Invalid tier',
        valid_tiers: ['basic', 'business', 'enterprise'],
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    await auditService.setRetentionPolicy(tenant_id, tier, client);

    // Get updated policy
    const policy = await auditService.getRetentionPolicy(tenant_id, client);

    // Log the policy change
    await auditService.createAuditLog({
      tenantId: tenant_id,
      eventType: auditService.EVENT_TYPES.SYSTEM_CONFIG_CHANGED,
      action: auditService.ACTIONS.UPDATE,
      resourceType: 'audit_retention_policy',
      userId: req.body.updated_by_user_id || null,
      eventData: {
        tier,
        retention_days: policy.retention_days,
      },
    }, client);

    res.json({
      success: true,
      policy,
    });
  } catch (error) {
    console.error('Error setting retention policy:', error);
    res.status(500).json({
      error: 'Failed to set retention policy',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

module.exports = router;
