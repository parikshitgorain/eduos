/**
 * Enrollment Routes
 * 
 * API endpoints for managing student enrollments.
 * 
 * Task: 2.1.3 - Create student enrollment workflow
 */

const express = require('express');
const router = express.Router();
const enrollmentService = require('../services/enrollmentService');

/**
 * POST /api/v1/enrollments
 * Create a new enrollment
 */
router.post('/', async (req, res) => {
  try {
    const { studentId, batchId, startDate, endDate, status, metadata } = req.body;
    
    const enrollment = await enrollmentService.createEnrollment({
      tenantId: req.tenant.id,
      studentId,
      batchId,
      startDate,
      endDate,
      status,
      metadata
    });
    
    res.status(201).json({
      success: true,
      enrollment
    });
  } catch (error) {
    if (error.message.includes('Validation failed') || error.message.includes('Duplicate enrollment')) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    } else if (error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else {
      console.error('Error creating enrollment:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
});

/**
 * GET /api/v1/enrollments/:id
 * Get enrollment by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const enrollment = await enrollmentService.getEnrollmentById(
      req.params.id,
      req.tenant.id
    );
    
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        error: 'Enrollment not found'
      });
    }
    
    res.json({
      success: true,
      enrollment
    });
  } catch (error) {
    console.error('Error fetching enrollment:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/v1/enrollments
 * List enrollments with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      studentId: req.query.studentId,
      batchId: req.query.batchId,
      status: req.query.status,
      startDateFrom: req.query.startDateFrom,
      startDateTo: req.query.startDateTo
    };
    
    const result = await enrollmentService.listEnrollments(req.tenant.id, options);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error listing enrollments:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * PATCH /api/v1/enrollments/:id/status
 * Update enrollment status
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, metadata } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed: status is required'
      });
    }
    
    const enrollment = await enrollmentService.updateEnrollmentStatus(
      req.params.id,
      req.tenant.id,
      status,
      metadata
    );
    
    res.json({
      success: true,
      enrollment
    });
  } catch (error) {
    if (error.message.includes('Validation failed')) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    } else if (error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else {
      console.error('Error updating enrollment status:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
});

/**
 * PATCH /api/v1/enrollments/:id/dates
 * Update enrollment dates
 */
router.patch('/:id/dates', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    const enrollment = await enrollmentService.updateEnrollmentDates(
      req.params.id,
      req.tenant.id,
      { startDate, endDate }
    );
    
    res.json({
      success: true,
      enrollment
    });
  } catch (error) {
    if (error.message.includes('Validation failed')) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    } else if (error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else {
      console.error('Error updating enrollment dates:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
});

/**
 * GET /api/v1/enrollments/student/:studentId/history
 * Get enrollment history for a student
 */
router.get('/student/:studentId/history', async (req, res) => {
  try {
    const enrollments = await enrollmentService.getStudentEnrollmentHistory(
      req.params.studentId,
      req.tenant.id
    );
    
    res.json({
      success: true,
      enrollments,
      count: enrollments.length
    });
  } catch (error) {
    console.error('Error fetching student enrollment history:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/v1/enrollments/bulk
 * Bulk create enrollments from CSV import
 */
router.post('/bulk', async (req, res) => {
  try {
    const { enrollments } = req.body;
    
    if (!enrollments || !Array.isArray(enrollments)) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed: enrollments must be an array'
      });
    }
    
    const results = await enrollmentService.bulkCreateEnrollments(
      req.tenant.id,
      enrollments
    );
    
    res.status(201).json({
      success: true,
      results: {
        successful: results.successful.length,
        failed: results.failed.length,
        total: enrollments.length
      },
      details: results
    });
  } catch (error) {
    if (error.message.includes('Validation failed')) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    } else {
      console.error('Error bulk creating enrollments:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
});

/**
 * DELETE /api/v1/enrollments/:id
 * Delete enrollment (soft delete by setting status to withdrawn)
 */
router.delete('/:id', async (req, res) => {
  try {
    const enrollment = await enrollmentService.deleteEnrollment(
      req.params.id,
      req.tenant.id
    );
    
    res.json({
      success: true,
      message: 'Enrollment withdrawn successfully',
      enrollment
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else {
      console.error('Error deleting enrollment:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
});

module.exports = router;
