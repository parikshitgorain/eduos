/**
 * Student Records Routes
 * Task: 2.2.5 - Historic rendering with snapshot association
 * 
 * API endpoints for:
 * - Rendering student records with their original schema snapshots
 * - Viewing student record history across schema versions
 * - Creating student records with snapshot association
 * - Transforming records to new schema versions (admin-initiated)
 */

const express = require('express');
const router = express.Router();
const schemaService = require('../services/schemaService');

/**
 * GET /api/v1/student-records/:recordId/render
 * Render a student record using its original schema snapshot
 * 
 * Response includes:
 * - Schema version badge (e.g., "Schema v1.2.3 - 2025-06-15")
 * - SHA-256 integrity verification status
 * - Rendered fields with original schema definitions
 */
router.get('/:recordId/render', async (req, res) => {
  try {
    const { recordId } = req.params;
    const tenantId = req.user.tenant_id;

    const rendered = await schemaService.renderRecordWithSnapshot(recordId, tenantId);

    res.json({
      success: true,
      data: rendered
    });
  } catch (error) {
    console.error('Error rendering student record:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message.includes('integrity check failed')) {
      return res.status(500).json({
        success: false,
        error: 'Schema integrity verification failed. Possible data tampering detected.',
        details: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to render student record',
      details: error.message
    });
  }
});

/**
 * POST /api/v1/student-records/render/batch
 * Render multiple student records in batch
 * 
 * Request body:
 * {
 *   "record_ids": ["uuid1", "uuid2", ...]
 * }
 */
router.post('/render/batch', async (req, res) => {
  try {
    const { record_ids } = req.body;
    const tenantId = req.user.tenant_id;

    if (!record_ids || !Array.isArray(record_ids)) {
      return res.status(400).json({
        success: false,
        error: 'record_ids must be an array'
      });
    }

    const results = await schemaService.renderRecordsWithSnapshots(record_ids, tenantId);

    res.json({
      success: true,
      data: results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.integrity_verified).length,
        failed: results.filter(r => !r.integrity_verified).length
      }
    });
  } catch (error) {
    console.error('Error rendering student records batch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to render student records',
      details: error.message
    });
  }
});

/**
 * GET /api/v1/student-records/student/:studentId/history
 * Get all records for a student across different schema versions
 * 
 * Returns a timeline of all records with their schema version badges
 */
router.get('/student/:studentId/history', async (req, res) => {
  try {
    const { studentId } = req.params;
    const tenantId = req.user.tenant_id;

    const history = await schemaService.getStudentRecordHistory(studentId, tenantId);

    res.json({
      success: true,
      data: {
        student_id: studentId,
        record_count: history.length,
        records: history
      }
    });
  } catch (error) {
    console.error('Error fetching student record history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch student record history',
      details: error.message
    });
  }
});

/**
 * POST /api/v1/student-records
 * Create a new student record with snapshot association
 * 
 * Request body:
 * {
 *   "student_id": "uuid",
 *   "snapshot_id": "uuid",
 *   "data": { ... }
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { student_id, snapshot_id, data } = req.body;
    const tenantId = req.user.tenant_id;
    const createdBy = req.user.user_id;

    if (!student_id || !snapshot_id || !data) {
      return res.status(400).json({
        success: false,
        error: 'student_id, snapshot_id, and data are required'
      });
    }

    const result = await schemaService.createStudentRecord({
      tenantId,
      studentId: student_id,
      snapshotId: snapshot_id,
      data,
      createdBy
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error creating student record:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message.includes('integrity check failed')) {
      return res.status(500).json({
        success: false,
        error: 'Schema integrity verification failed',
        details: error.message
      });
    }
    
    if (error.message.includes('Required field')) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create student record',
      details: error.message
    });
  }
});

/**
 * POST /api/v1/student-records/:recordId/transform
 * Transform a record to a new schema version (admin-initiated export)
 * 
 * This creates a NEW artifact and does NOT modify the original record
 * 
 * Request body:
 * {
 *   "target_snapshot_id": "uuid",
 *   "field_mappings": {
 *     "new_field_name": "old_field_name"
 *   }
 * }
 * 
 * Requires admin role
 */
router.post('/:recordId/transform', async (req, res) => {
  try {
    // Check if user has admin role
    if (!req.user.roles || !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        error: 'Only admins can transform records'
      });
    }

    const { recordId } = req.params;
    const { target_snapshot_id, field_mappings = {} } = req.body;
    const tenantId = req.user.tenant_id;
    const transformedBy = req.user.user_id;

    if (!target_snapshot_id) {
      return res.status(400).json({
        success: false,
        error: 'target_snapshot_id is required'
      });
    }

    const result = await schemaService.transformRecordToNewSchema(
      recordId,
      target_snapshot_id,
      tenantId,
      transformedBy,
      field_mappings
    );

    res.json({
      success: true,
      data: result,
      message: 'Transformation completed. Original record remains unchanged.'
    });
  } catch (error) {
    console.error('Error transforming student record:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message.includes('integrity check failed')) {
      return res.status(500).json({
        success: false,
        error: 'Schema integrity verification failed',
        details: error.message
      });
    }
    
    if (error.message.includes('Required field')) {
      return res.status(400).json({
        success: false,
        error: 'Transformation validation failed',
        details: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to transform student record',
      details: error.message
    });
  }
});

module.exports = router;
