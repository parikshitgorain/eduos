/**
 * Schema Routes
 * 
 * API endpoints for schema definition and storage system
 * Task: 2.2.1 - Build schema definition and storage system
 */

const express = require('express');
const router = express.Router();
const schemaService = require('../services/schemaService');

/**
 * POST /api/v1/schemas
 * Create a new schema snapshot
 */
router.post('/', async (req, res) => {
  try {
    const { formType, fields, changeSummary, parentSnapshotId, changeType, status } = req.body;
    const tenantId = req.user.tenant_id;
    const createdBy = req.user.user_id;
    
    const result = await schemaService.createSchemaSnapshot({
      tenantId,
      formType,
      fields,
      createdBy,
      changeSummary,
      parentSnapshotId,
      changeType,
      status
    });
    
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error creating schema snapshot:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/schemas
 * List schema snapshots with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { page, limit, formType, status } = req.query;
    
    const result = await schemaService.listSchemaSnapshots(tenantId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      formType,
      status
    });
    
    res.json({
      success: true,
      data: result.snapshots,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error listing schema snapshots:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/schemas/:snapshotId
 * Get schema snapshot by ID
 */
router.get('/:snapshotId', async (req, res) => {
  try {
    const { snapshotId } = req.params;
    const tenantId = req.user.tenant_id;
    
    const snapshot = await schemaService.getSchemaSnapshotById(snapshotId, tenantId);
    
    if (!snapshot) {
      return res.status(404).json({
        success: false,
        error: 'Schema snapshot not found'
      });
    }
    
    res.json({
      success: true,
      data: snapshot
    });
  } catch (error) {
    console.error('Error getting schema snapshot:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/schemas/latest/:formType
 * Get latest active schema for a form type
 */
router.get('/latest/:formType', async (req, res) => {
  try {
    const { formType } = req.params;
    const tenantId = req.user.tenant_id;
    
    const snapshot = await schemaService.getLatestSchema(tenantId, formType);
    
    if (!snapshot) {
      return res.status(404).json({
        success: false,
        error: `No active schema found for form type: ${formType}`
      });
    }
    
    res.json({
      success: true,
      data: snapshot
    });
  } catch (error) {
    console.error('Error getting latest schema:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/schemas/:snapshotId/history
 * Get schema version history for a form type
 */
router.get('/:snapshotId/history', async (req, res) => {
  try {
    const { snapshotId } = req.params;
    const tenantId = req.user.tenant_id;
    
    // First get the snapshot to find the form type
    const snapshot = await schemaService.getSchemaSnapshotById(snapshotId, tenantId);
    
    if (!snapshot) {
      return res.status(404).json({
        success: false,
        error: 'Schema snapshot not found'
      });
    }
    
    const history = await schemaService.getSchemaVersionHistory(tenantId, snapshot.form_type);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error getting schema history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/schemas/:snapshotId/verify
 * Verify schema integrity
 */
router.get('/:snapshotId/verify', async (req, res) => {
  try {
    const { snapshotId } = req.params;
    const tenantId = req.user.tenant_id;
    
    const result = await schemaService.verifySchemaIntegrity(snapshotId, tenantId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error verifying schema integrity:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PATCH /api/v1/schemas/:snapshotId/status
 * Update schema status
 */
router.patch('/:snapshotId/status', async (req, res) => {
  try {
    const { snapshotId } = req.params;
    const { status } = req.body;
    const tenantId = req.user.tenant_id;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }
    
    const result = await schemaService.updateSchemaStatus(snapshotId, tenantId, status);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error updating schema status:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/schemas/:snapshotId/export
 * Export schema
 */
router.post('/:snapshotId/export', async (req, res) => {
  try {
    const { snapshotId } = req.params;
    const { format = 'json' } = req.body;
    const tenantId = req.user.tenant_id;
    const exportedBy = req.user.user_id;
    
    const result = await schemaService.exportSchema(snapshotId, tenantId, exportedBy, format);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error exporting schema:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/schemas/import
 * Import schema
 */
router.post('/import', async (req, res) => {
  try {
    const { importData, importMode, conflictResolution } = req.body;
    const tenantId = req.user.tenant_id;
    const importedBy = req.user.user_id;
    
    if (!importData) {
      return res.status(400).json({
        success: false,
        error: 'Import data is required'
      });
    }
    
    const result = await schemaService.importSchema(tenantId, importData, importedBy, {
      importMode,
      conflictResolution
    });
    
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error importing schema:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/schemas/field-types
 * Get supported field types
 */
router.get('/field-types', (req, res) => {
  res.json({
    success: true,
    data: {
      field_types: schemaService.FIELD_TYPES,
      validation_rule_types: schemaService.VALIDATION_RULE_TYPES
    }
  });
});

module.exports = router;
