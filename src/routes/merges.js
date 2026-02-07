/**
 * Merge Operations Routes
 * Task: 3.3.3 Create merge audit trail and reversibility
 * 
 * Provides REST API endpoints for:
 * - Merge execution with audit trail
 * - Merge history retrieval
 * - Merge restore/undo operations
 */

const express = require('express');
const router = express.Router();
const studentMergeService = require('../services/studentMergeService');

/**
 * POST /api/v1/merges
 * Execute a student merge operation
 */
router.post('/', async (req, res) => {
  try {
    const { primaryStudentId, secondaryStudentIds, mergeReason } = req.body;
    const tenantId = req.tenantId; // From tenant context middleware
    const mergedBy = req.user.userId; // From auth middleware
    
    // Validate required fields
    if (!primaryStudentId || !secondaryStudentIds || !mergeReason) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['primaryStudentId', 'secondaryStudentIds', 'mergeReason']
      });
    }
    
    const result = await studentMergeService.executeMerge({
      tenantId,
      primaryStudentId,
      secondaryStudentIds,
      mergeReason,
      mergedBy
    });
    
    res.status(201).json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Merge execution error:', error);
    res.status(500).json({
      error: 'Failed to execute merge',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/merges/impact-assessment
 * Get impact assessment for a potential merge without executing it
 */
router.post('/impact-assessment', async (req, res) => {
  try {
    const { primaryStudentId, secondaryStudentIds } = req.body;
    const tenantId = req.tenantId;
    
    if (!primaryStudentId || !secondaryStudentIds) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['primaryStudentId', 'secondaryStudentIds']
      });
    }
    
    const assessment = await studentMergeService.getImpactAssessment({
      tenantId,
      primaryStudentId,
      secondaryStudentIds
    });
    
    res.status(200).json({
      success: true,
      data: assessment
    });
    
  } catch (error) {
    console.error('Impact assessment error:', error);
    res.status(500).json({
      error: 'Failed to calculate impact assessment',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/merges/:mergeId
 * Get details of a specific merge operation
 */
router.get('/:mergeId', async (req, res) => {
  try {
    const { mergeId } = req.params;
    const tenantId = req.tenantId;
    
    const mergeDetails = await studentMergeService.getMergeDetails(mergeId, tenantId);
    
    res.status(200).json({
      success: true,
      data: mergeDetails
    });
    
  } catch (error) {
    console.error('Get merge details error:', error);
    const statusCode = error.message === 'Merge not found' ? 404 : 500;
    res.status(statusCode).json({
      error: 'Failed to retrieve merge details',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/merges/student/:studentId/history
 * Get merge history for a specific student
 */
router.get('/student/:studentId/history', async (req, res) => {
  try {
    const { studentId } = req.params;
    const tenantId = req.tenantId;
    
    const history = await studentMergeService.getMergeHistory({
      tenantId,
      studentId
    });
    
    res.status(200).json({
      success: true,
      data: {
        studentId,
        merges: history
      }
    });
    
  } catch (error) {
    console.error('Get merge history error:', error);
    res.status(500).json({
      error: 'Failed to retrieve merge history',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/merges/:mergeId/restore
 * Restore (undo) a merge operation within SLA window
 */
router.post('/:mergeId/restore', async (req, res) => {
  try {
    const { mergeId } = req.params;
    const { reverseReason } = req.body;
    const tenantId = req.tenantId;
    const reversedBy = req.user.userId;
    
    if (!reverseReason) {
      return res.status(400).json({
        error: 'Missing required field',
        required: ['reverseReason']
      });
    }
    
    const result = await studentMergeService.restoreMerge({
      mergeId,
      tenantId,
      reversedBy,
      reverseReason
    });
    
    res.status(200).json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Restore merge error:', error);
    const statusCode = error.message.includes('not found') ? 404 :
                       error.message.includes('expired') ? 403 :
                       error.message.includes('already been reversed') ? 409 : 500;
    res.status(statusCode).json({
      error: 'Failed to restore merge',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/merges/:mergeId/restore-preview
 * Get preview of what will be restored without executing the restore
 */
router.get('/:mergeId/restore-preview', async (req, res) => {
  try {
    const { mergeId } = req.params;
    const tenantId = req.tenantId;
    
    const preview = await studentMergeService.getRestorePreview(mergeId, tenantId);
    
    res.status(200).json({
      success: true,
      data: preview
    });
    
  } catch (error) {
    console.error('Get restore preview error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      error: 'Failed to generate restore preview',
      message: error.message
    });
  }
});

module.exports = router;
