/**
 * Payments Routes
 * 
 * Handles payment creation and retrieval
 */

const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { body, param, validationResult } = require('express-validator');

/**
 * Health check
 * 
 * GET /api/v1/payments/health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Payment service is healthy',
    test_mode: paymentService.isTestMode(),
    configured: paymentService.isConfigured(),
    active_gateway: paymentService.isConfigured() ? paymentService.getActiveGateway() : null,
  });
});

/**
 * Get supported payment methods
 * 
 * GET /api/v1/payments/methods
 */
router.get('/methods', (req, res) => {
  try {
    const methods = paymentService.getSupportedPaymentMethods();

    res.json({
      success: true,
      data: methods,
    });
  } catch (error) {
    console.error('Payment methods error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve payment methods',
      message: error.message,
    });
  }
});

/**
 * Create payment intent/order
 * 
 * POST /api/v1/payments
 */
router.post(
  '/',
  [
    body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer'),
    body('currency').optional().isString().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3-letter code'),
    body('student_id').isUUID().withMessage('Student ID must be a valid UUID'),
    body('description').isString().notEmpty().withMessage('Description is required'),
    body('metadata').optional().isObject().withMessage('Metadata must be an object'),
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

      const { amount, currency, student_id, description, metadata } = req.body;
      const tenantId = req.tenantId; // From tenant context middleware

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant ID is required',
        });
      }

      // Create payment
      const payment = await paymentService.createPayment({
        amount,
        currency,
        tenantId,
        studentId: student_id,
        description,
        metadata,
      });

      res.status(201).json({
        success: true,
        data: payment,
      });
    } catch (error) {
      console.error('Payment creation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create payment',
        message: error.message,
      });
    }
  }
);

/**
 * Get payment details
 * 
 * GET /api/v1/payments/:gateway/:paymentId
 */
router.get(
  '/:gateway/:paymentId',
  [
    param('gateway').isIn(['stripe', 'razorpay']).withMessage('Gateway must be stripe or razorpay'),
    param('paymentId').isString().notEmpty().withMessage('Payment ID is required'),
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

      const { gateway, paymentId } = req.params;

      // Get payment details
      const payment = await paymentService.getPayment(paymentId, gateway);

      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      console.error('Payment retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve payment',
        message: error.message,
      });
    }
  }
);

module.exports = router;
