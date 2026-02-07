/**
 * Students API Routes
 * Task 3.2.1: Build deterministic fuzzy matching layer
 */

const express = require('express');
const router = express.Router();
const duplicateDetectionService = require('../services/duplicateDetectionService');

/**
 * POST /api/v1/students/check-duplicates
 * Check for duplicate students using deterministic fuzzy matching
 * 
 * Request body:
 * {
 *   "first_name": "John",
 *   "last_name": "Doe",
 *   "date_of_birth": "2005-03-15",
 *   "tenant_id": "uuid",
 *   "student_id": "uuid" (optional - for updates)
 * }
 * 
 * Response:
 * {
 *   "duplicates": [
 *     {
 *       "candidate_student_id": "uuid",
 *       "candidate_first_name": "John",
 *       "candidate_last_name": "Doe",
 *       "candidate_date_of_birth": "2005-03-15",
 *       "likelihood_score": 0.89,
 *       "deterministic_score": 0.89,
 *       "first_name_similarity": 0.95,
 *       "last_name_similarity": 0.92,
 *       "dob_match": 1.0,
 *       "reason_codes": ["High name similarity", "Date of birth exact match"],
 *       "status": "pending_review"
 *     }
 *   ],
 *   "has_duplicates": true,
 *   "count": 1
 * }
 */
router.post('/check-duplicates', async (req, res) => {
  try {
    const { first_name, last_name, date_of_birth, tenant_id, student_id } = req.body;
    
    // Validate required fields
    if (!first_name || !last_name || !tenant_id) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['first_name', 'last_name', 'tenant_id']
      });
    }
    
    // Check for duplicates
    const duplicates = await duplicateDetectionService.checkDuplicates({
      first_name,
      last_name,
      date_of_birth,
      tenant_id,
      student_id
    });
    
    res.json({
      duplicates,
      has_duplicates: duplicates.length > 0,
      count: duplicates.length
    });
  } catch (error) {
    console.error('Error checking duplicates:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/students/batch-check-duplicates
 * Batch check for duplicates (for bulk imports)
 * 
 * Request body:
 * {
 *   "students": [
 *     {
 *       "first_name": "John",
 *       "last_name": "Doe",
 *       "date_of_birth": "2005-03-15"
 *     },
 *     ...
 *   ],
 *   "tenant_id": "uuid"
 * }
 * 
 * Response:
 * {
 *   "results": [
 *     {
 *       "input_student": {...},
 *       "duplicates": [...],
 *       "has_duplicates": true
 *     },
 *     ...
 *   ],
 *   "total_checked": 10,
 *   "total_with_duplicates": 2
 * }
 */
router.post('/batch-check-duplicates', async (req, res) => {
  try {
    const { students, tenant_id } = req.body;
    
    // Validate required fields
    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid students array'
      });
    }
    
    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required field: tenant_id'
      });
    }
    
    // Batch check duplicates
    const results = await duplicateDetectionService.batchCheckDuplicates(
      students,
      tenant_id
    );
    
    const totalWithDuplicates = results.filter(r => r.has_duplicates).length;
    
    res.json({
      results,
      total_checked: results.length,
      total_with_duplicates: totalWithDuplicates
    });
  } catch (error) {
    console.error('Error batch checking duplicates:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
