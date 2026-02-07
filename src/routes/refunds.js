/**
 * Refunds Routes
 * 
 * Handles refund request creation, approval chain, and processing
 * Approval chain: Teacher → Admin → Finance Manager
 */

const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { body, param, query, validationResult } = require('express-validator');

/**
 * Create refund request
 * 
 * POST /api/v1/refunds
 */
router.post(
  '/',
  [
    body('payment_id').optional().isUUID().withMessage('Payment ID must be a valid UUID'),
    body('invoice_id').optional().isUUID().withMessage('Invoice ID must be a valid UUID'),
    body('refund_amount').isInt({ min: 1 }).withMessage('Refund amount must be a positive integer'),
    body('refund_type').isIn(['full', 'partial']).withMessage('Refund type must be "full" or "partial"'),
    body('reason').isString().notEmpty().withMessage('Reason is required'),
    body('supporting_documents').optional().isArray().withMessage('Supporting documents must be an array'),
    body('requested_by').isUUID().withMessage('Requested by must be a valid UUID'),
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { payment_id, invoice_id, refund_amount, refund_type, reason, supporting_documents, requested_by } = req.body;
      const tenantId = req.tenantId; // From tenant context middleware

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant ID is required',
        });
      }

      // Validate that at least one of payment_id or invoice_id is provided
      if (!payment_id && !invoice_id) {
        return res.status(400).json({
          success: false,
          error: 'Either payment_id or invoice_id must be provided',
        });
      }

      // Create refund request
      const refundRequest = await paymentService.createRefundRequest({
        tenantId,
        paymentId: payment_id,
        invoiceId: invoice_id,
        refundAmount: refund_amount,
        refundType: refund_type,
        reason,
        supportingDocuments: supporting_documents || [],
        requestedBy: requested_by,
      }, req.db);

      res.status(201).json({
        success: true,
        data: refundRequest,
      });
    } catch (error) {
      console.error('Refund request creation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create refund request',
        message: error.message,
      });
    }
  }
);

/**
 * Get refund request by ID
 * 
 * GET /api/v1/refunds/:id
 */
router.get(
  '/:id',
  [
    param('id').isUUID().withMessage('Refund request ID must be a valid UUID'),
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { id } = req.params;
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant ID is required',
        });
      }

      // Get refund request
      const refundRequest = await paymentService.getRefundRequest(id, tenantId, req.db);

      res.json({
        success: true,
        data: refundRequest,
      });
    } catch (error) {
      console.error('Refund request retrieval error:', error);
      
      if (error.message === 'Refund request not found') {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve refund request',
        message: error.message,
      });
    }
  }
);

/**
 * List refund requests
 * 
 * GET /api/v1/refunds
 */
router.get(
  '/',
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    query('status').optional().isIn(['pending', 'approved', 'rejected', 'processed', 'cancelled']).withMessage('Invalid status'),
    query('payment_id').optional().isUUID().withMessage('Payment ID must be a valid UUID'),
    query('invoice_id').optional().isUUID().withMessage('Invoice ID must be a valid UUID'),
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant ID is required',
        });
      }

      const { limit, offset, status, payment_id, invoice_id } = req.query;

      // List refund requests
      const refundRequests = await paymentService.listRefundRequests(tenantId, req.db, {
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
        status,
        paymentId: payment_id,
        invoiceId: invoice_id,
      });

      res.json({
        success: true,
        data: refundRequests,
        count: refundRequests.length,
      });
    } catch (error) {
      console.error('Refund requests listing error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list refund requests',
        message: error.message,
      });
    }
  }
);

/**
 * Approve refund request (approval chain step)
 * 
 * POST /api/v1/refunds/:id/approve
 */
router.post(
  '/:id/approve',
  [
    param('id').isUUID().withMessage('Refund request ID must be a valid UUID'),
    body('approver_role').isIn(['teacher', 'admin', 'finance_manager']).withMessage('Invalid approver role'),
    body('approver_id').isUUID().withMessage('Approver ID must be a valid UUID'),
    body('comments').optional().isString().withMessage('Comments must be a string'),
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { id } = req.params;
      const { approver_role, approver_id, comments } = req.body;
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant ID is required',
        });
      }

      // Approve refund request
      const refundRequest = await paymentService.approveRefundRequest(
        id,
        tenantId,
        approver_role,
        approver_id,
        comments,
        req.db
      );

      res.json({
        success: true,
        data: refundRequest,
        message: `Refund request approved by ${approver_role}`,
      });
    } catch (error) {
      console.error('Refund approval error:', error);
      
      if (error.message.includes('not found') || error.message.includes('required first')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to approve refund request',
        message: error.message,
      });
    }
  }
);

/**
 * Reject refund request
 * 
 * POST /api/v1/refunds/:id/reject
 */
router.post(
  '/:id/reject',
  [
    param('id').isUUID().withMessage('Refund request ID must be a valid UUID'),
    body('approver_role').isIn(['teacher', 'admin', 'finance_manager']).withMessage('Invalid approver role'),
    body('approver_id').isUUID().withMessage('Approver ID must be a valid UUID'),
    body('rejection_reason').isString().notEmpty().withMessage('Rejection reason is required'),
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { id } = req.params;
      const { approver_role, approver_id, rejection_reason } = req.body;
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant ID is required',
        });
      }

      // Reject refund request
      const refundRequest = await paymentService.rejectRefundRequest(
        id,
        tenantId,
        approver_role,
        approver_id,
        rejection_reason,
        req.db
      );

      res.json({
        success: true,
        data: refundRequest,
        message: `Refund request rejected by ${approver_role}`,
      });
    } catch (error) {
      console.error('Refund rejection error:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to reject refund request',
        message: error.message,
      });
    }
  }
);

/**
 * Process approved refund (execute refund with payment gateway)
 * 
 * POST /api/v1/refunds/:id/process
 */
router.post(
  '/:id/process',
  [
    param('id').isUUID().withMessage('Refund request ID must be a valid UUID'),
    body('processed_by').isUUID().withMessage('Processed by must be a valid UUID'),
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { id } = req.params;
      const { processed_by } = req.body;
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant ID is required',
        });
      }

      // Process refund
      const refundRequest = await paymentService.processRefund(
        id,
        tenantId,
        processed_by,
        req.db
      );

      res.json({
        success: true,
        data: refundRequest,
        message: 'Refund processed successfully',
      });
    } catch (error) {
      console.error('Refund processing error:', error);
      
      if (error.message.includes('not found') || error.message.includes('must be approved')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to process refund',
        message: error.message,
      });
    }
  }
);

/**
 * Get refund approval history
 * 
 * GET /api/v1/refunds/:id/history
 */
router.get(
  '/:id/history',
  [
    param('id').isUUID().withMessage('Refund request ID must be a valid UUID'),
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { id } = req.params;
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant ID is required',
        });
      }

      // Get approval history
      const history = await paymentService.getRefundApprovalHistory(id, tenantId, req.db);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error('Refund history retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve refund approval history',
        message: error.message,
      });
    }
  }
);

module.exports = router;
