/**
 * Duplicate Review Queue API Routes
 * Task 3.2.4: Build duplicate review queue UI
 * 
 * Provides endpoints for managing the duplicate review queue where admins
 * can review flagged duplicate pairs and make decisions (Merge, Not a Duplicate, Need More Info)
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');

/**
 * GET /api/v1/duplicate-review-queue
 * Get all flagged duplicate pairs for review
 * 
 * Query parameters:
 * - tenant_id: Filter by tenant (required)
 * - status: Filter by status (pending_review, approved, rejected, need_more_info)
 * - sort: Sort by likelihood_score (desc) or created_at (desc)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * 
 * Response:
 * {
 *   "pairs": [
 *     {
 *       "queue_id": "uuid",
 *       "primary_student": {...},
 *       "candidate_student": {...},
 *       "likelihood_score": 0.89,
 *       "deterministic_score": 0.82,
 *       "ai_similarity_score": 0.95,
 *       "reason_codes": [...],
 *       "explainability": {...},
 *       "status": "pending_review",
 *       "created_at": "2026-02-07T10:00:00Z"
 *     }
 *   ],
 *   "pagination": {
 *     "page": 1,
 *     "limit": 20,
 *     "total": 45,
 *     "total_pages": 3
 *   }
 * }
 */
router.get('/', async (req, res) => {
  try {
    const { tenant_id, status, sort = 'likelihood_score', page = 1, limit = 20 } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required parameter: tenant_id'
      });
    }
    
    const pool = getPool();
    const offset = (page - 1) * limit;
    
    // Build query
    let query = `
      SELECT 
        drq.queue_id,
        drq.primary_student_id,
        drq.candidate_student_id,
        drq.likelihood_score,
        drq.deterministic_score,
        drq.ai_similarity_score,
        drq.first_name_similarity,
        drq.last_name_similarity,
        drq.dob_match,
        drq.reason_codes,
        drq.explainability,
        drq.status,
        drq.created_at,
        drq.reviewed_at,
        drq.reviewed_by,
        drq.review_notes,
        ps.first_name as primary_first_name,
        ps.last_name as primary_last_name,
        ps.date_of_birth as primary_date_of_birth,
        ps.email as primary_email,
        ps.phone as primary_phone,
        ps.created_at as primary_created_at,
        cs.first_name as candidate_first_name,
        cs.last_name as candidate_last_name,
        cs.date_of_birth as candidate_date_of_birth,
        cs.email as candidate_email,
        cs.phone as candidate_phone,
        cs.created_at as candidate_created_at
      FROM duplicate_review_queue drq
      JOIN students ps ON drq.primary_student_id = ps.student_id
      JOIN students cs ON drq.candidate_student_id = cs.student_id
      WHERE drq.tenant_id = $1
    `;
    
    const params = [tenant_id];
    let paramIndex = 2;
    
    // Filter by status
    if (status) {
      query += ` AND drq.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    // Count total for pagination
    const countQuery = query.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    
    // Add sorting
    if (sort === 'likelihood_score') {
      query += ' ORDER BY drq.likelihood_score DESC, drq.created_at DESC';
    } else {
      query += ' ORDER BY drq.created_at DESC';
    }
    
    // Add pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Format response
    const pairs = result.rows.map(row => ({
      queue_id: row.queue_id,
      primary_student: {
        student_id: row.primary_student_id,
        first_name: row.primary_first_name,
        last_name: row.primary_last_name,
        date_of_birth: row.primary_date_of_birth,
        email: row.primary_email,
        phone: row.primary_phone,
        created_at: row.primary_created_at
      },
      candidate_student: {
        student_id: row.candidate_student_id,
        first_name: row.candidate_first_name,
        last_name: row.candidate_last_name,
        date_of_birth: row.candidate_date_of_birth,
        email: row.candidate_email,
        phone: row.candidate_phone,
        created_at: row.candidate_created_at
      },
      likelihood_score: row.likelihood_score,
      deterministic_score: row.deterministic_score,
      ai_similarity_score: row.ai_similarity_score,
      first_name_similarity: row.first_name_similarity,
      last_name_similarity: row.last_name_similarity,
      dob_match: row.dob_match,
      reason_codes: row.reason_codes,
      explainability: row.explainability,
      status: row.status,
      created_at: row.created_at,
      reviewed_at: row.reviewed_at,
      reviewed_by: row.reviewed_by,
      review_notes: row.review_notes
    }));
    
    res.json({
      pairs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        total_pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching duplicate review queue:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/duplicate-review-queue
 * Add a duplicate pair to the review queue
 * 
 * Request body:
 * {
 *   "tenant_id": "uuid",
 *   "primary_student_id": "uuid",
 *   "candidate_student_id": "uuid",
 *   "likelihood_score": 0.89,
 *   "deterministic_score": 0.82,
 *   "ai_similarity_score": 0.95,
 *   "first_name_similarity": 0.95,
 *   "last_name_similarity": 0.92,
 *   "dob_match": 1.0,
 *   "reason_codes": ["High name similarity", "Date of birth exact match"],
 *   "explainability": {...}
 * }
 * 
 * Response:
 * {
 *   "queue_id": "uuid",
 *   "status": "pending_review",
 *   "created_at": "2026-02-07T10:00:00Z"
 * }
 */
router.post('/', async (req, res) => {
  try {
    const {
      tenant_id,
      primary_student_id,
      candidate_student_id,
      likelihood_score,
      deterministic_score,
      ai_similarity_score,
      first_name_similarity,
      last_name_similarity,
      dob_match,
      reason_codes,
      explainability
    } = req.body;
    
    // Validate required fields
    if (!tenant_id || !primary_student_id || !candidate_student_id || likelihood_score === undefined) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['tenant_id', 'primary_student_id', 'candidate_student_id', 'likelihood_score']
      });
    }
    
    const pool = getPool();
    
    // Check if this pair already exists in the queue
    const existingQuery = `
      SELECT queue_id, status FROM duplicate_review_queue
      WHERE tenant_id = $1
        AND (
          (primary_student_id = $2 AND candidate_student_id = $3)
          OR (primary_student_id = $3 AND candidate_student_id = $2)
        )
    `;
    
    const existingResult = await pool.query(existingQuery, [
      tenant_id,
      primary_student_id,
      candidate_student_id
    ]);
    
    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        error: 'Duplicate pair already exists in queue',
        queue_id: existingResult.rows[0].queue_id,
        status: existingResult.rows[0].status
      });
    }
    
    // Insert into queue
    const insertQuery = `
      INSERT INTO duplicate_review_queue (
        tenant_id,
        primary_student_id,
        candidate_student_id,
        likelihood_score,
        deterministic_score,
        ai_similarity_score,
        first_name_similarity,
        last_name_similarity,
        dob_match,
        reason_codes,
        explainability,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending_review', NOW())
      RETURNING queue_id, status, created_at
    `;
    
    const result = await pool.query(insertQuery, [
      tenant_id,
      primary_student_id,
      candidate_student_id,
      likelihood_score,
      deterministic_score,
      ai_similarity_score,
      first_name_similarity,
      last_name_similarity,
      dob_match,
      JSON.stringify(reason_codes || []),
      JSON.stringify(explainability || {})
    ]);
    
    res.status(201).json({
      queue_id: result.rows[0].queue_id,
      status: result.rows[0].status,
      created_at: result.rows[0].created_at
    });
  } catch (error) {
    console.error('Error adding to duplicate review queue:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/duplicate-review-queue/:queue_id
 * Get details of a specific duplicate pair
 * 
 * Response:
 * {
 *   "queue_id": "uuid",
 *   "primary_student": {...},
 *   "candidate_student": {...},
 *   "likelihood_score": 0.89,
 *   "reason_codes": [...],
 *   "explainability": {...},
 *   "status": "pending_review",
 *   "created_at": "2026-02-07T10:00:00Z"
 * }
 */
router.get('/:queue_id', async (req, res) => {
  try {
    const { queue_id } = req.params;
    const { tenant_id } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required parameter: tenant_id'
      });
    }
    
    const pool = getPool();
    
    const query = `
      SELECT 
        drq.*,
        ps.first_name as primary_first_name,
        ps.last_name as primary_last_name,
        ps.date_of_birth as primary_date_of_birth,
        ps.email as primary_email,
        ps.phone as primary_phone,
        ps.created_at as primary_created_at,
        cs.first_name as candidate_first_name,
        cs.last_name as candidate_last_name,
        cs.date_of_birth as candidate_date_of_birth,
        cs.email as candidate_email,
        cs.phone as candidate_phone,
        cs.created_at as candidate_created_at
      FROM duplicate_review_queue drq
      JOIN students ps ON drq.primary_student_id = ps.student_id
      JOIN students cs ON drq.candidate_student_id = cs.student_id
      WHERE drq.queue_id = $1 AND drq.tenant_id = $2
    `;
    
    const result = await pool.query(query, [queue_id, tenant_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Duplicate pair not found'
      });
    }
    
    const row = result.rows[0];
    
    res.json({
      queue_id: row.queue_id,
      primary_student: {
        student_id: row.primary_student_id,
        first_name: row.primary_first_name,
        last_name: row.primary_last_name,
        date_of_birth: row.primary_date_of_birth,
        email: row.primary_email,
        phone: row.primary_phone,
        created_at: row.primary_created_at
      },
      candidate_student: {
        student_id: row.candidate_student_id,
        first_name: row.candidate_first_name,
        last_name: row.candidate_last_name,
        date_of_birth: row.candidate_date_of_birth,
        email: row.candidate_email,
        phone: row.candidate_phone,
        created_at: row.candidate_created_at
      },
      likelihood_score: row.likelihood_score,
      deterministic_score: row.deterministic_score,
      ai_similarity_score: row.ai_similarity_score,
      first_name_similarity: row.first_name_similarity,
      last_name_similarity: row.last_name_similarity,
      dob_match: row.dob_match,
      reason_codes: row.reason_codes,
      explainability: row.explainability,
      status: row.status,
      created_at: row.created_at,
      reviewed_at: row.reviewed_at,
      reviewed_by: row.reviewed_by,
      review_notes: row.review_notes
    });
  } catch (error) {
    console.error('Error fetching duplicate pair:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * PATCH /api/v1/duplicate-review-queue/:queue_id/review
 * Review a duplicate pair and make a decision
 * 
 * Request body:
 * {
 *   "tenant_id": "uuid",
 *   "decision": "merge" | "not_duplicate" | "need_more_info",
 *   "reviewed_by": "user_id",
 *   "review_notes": "Optional notes about the decision"
 * }
 * 
 * Response:
 * {
 *   "queue_id": "uuid",
 *   "status": "approved" | "rejected" | "need_more_info",
 *   "reviewed_at": "2026-02-07T10:30:00Z"
 * }
 */
router.patch('/:queue_id/review', async (req, res) => {
  try {
    const { queue_id } = req.params;
    const { tenant_id, decision, reviewed_by, review_notes } = req.body;
    
    if (!tenant_id || !decision || !reviewed_by) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['tenant_id', 'decision', 'reviewed_by']
      });
    }
    
    // Validate decision
    const validDecisions = ['merge', 'not_duplicate', 'need_more_info'];
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({
        error: 'Invalid decision',
        valid_decisions: validDecisions
      });
    }
    
    // Map decision to status
    const statusMap = {
      'merge': 'approved',
      'not_duplicate': 'rejected',
      'need_more_info': 'need_more_info'
    };
    const status = statusMap[decision];
    
    const pool = getPool();
    
    // Update the queue item
    const updateQuery = `
      UPDATE duplicate_review_queue
      SET 
        status = $1,
        reviewed_at = NOW(),
        reviewed_by = $2,
        review_notes = $3
      WHERE queue_id = $4 AND tenant_id = $5
      RETURNING queue_id, status, reviewed_at
    `;
    
    const result = await pool.query(updateQuery, [
      status,
      reviewed_by,
      review_notes || null,
      queue_id,
      tenant_id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Duplicate pair not found'
      });
    }
    
    res.json({
      queue_id: result.rows[0].queue_id,
      status: result.rows[0].status,
      reviewed_at: result.rows[0].reviewed_at,
      decision
    });
  } catch (error) {
    console.error('Error reviewing duplicate pair:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/duplicate-review-queue/stats
 * Get statistics about the duplicate review queue
 * 
 * Query parameters:
 * - tenant_id: Filter by tenant (required)
 * 
 * Response:
 * {
 *   "total": 45,
 *   "pending_review": 30,
 *   "approved": 10,
 *   "rejected": 3,
 *   "need_more_info": 2,
 *   "avg_likelihood_score": 0.84
 * }
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const { tenant_id } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required parameter: tenant_id'
      });
    }
    
    const pool = getPool();
    
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending_review') as pending_review,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'need_more_info') as need_more_info,
        AVG(likelihood_score) as avg_likelihood_score
      FROM duplicate_review_queue
      WHERE tenant_id = $1
    `;
    
    const result = await pool.query(query, [tenant_id]);
    const stats = result.rows[0];
    
    res.json({
      total: parseInt(stats.total),
      pending_review: parseInt(stats.pending_review),
      approved: parseInt(stats.approved),
      rejected: parseInt(stats.rejected),
      need_more_info: parseInt(stats.need_more_info),
      avg_likelihood_score: stats.avg_likelihood_score ? parseFloat(stats.avg_likelihood_score).toFixed(2) : null
    });
  } catch (error) {
    console.error('Error fetching queue stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
