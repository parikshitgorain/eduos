/**
 * Webhooks Routes
 * 
 * Handles payment gateway webhooks
 * Endpoint: POST /api/v1/webhooks/payments
 */

const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { getPool } = require('../config/database');

/**
 * Payment webhook handler
 * 
 * Handles webhooks from Stripe and Razorpay
 * Implements idempotency using webhook_id + tenant_id
 * Implements retry logic with exponential backoff
 */
router.post('/payments', express.raw({ type: 'application/json' }), async (req, res) => {
  const pool = getPool();
  let idempotencyKey = null;
  let tenantId = null;

  try {
    const signature = req.headers['x-razorpay-signature'] || req.headers['stripe-signature'];
    const gateway = req.headers['x-razorpay-signature'] ? 'razorpay' : 'stripe';

    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing webhook signature',
      });
    }

    // Parse and verify webhook event
    const event = paymentService.parseWebhookEvent(
      req.body.toString(),
      signature,
      gateway
    );

    // Extract tenant_id from metadata
    tenantId = event.metadata?.tenant_id;
    if (!tenantId) {
      console.error('Webhook missing tenant_id in metadata:', event);
      return res.status(400).json({
        success: false,
        error: 'Missing tenant_id in webhook metadata',
      });
    }

    // Check idempotency: webhook_id + tenant_id
    idempotencyKey = `${event.id}_${tenantId}`;

    // Check if webhook already processed
    const existingWebhook = await pool.query(
      `SELECT id, status FROM webhook_logs 
       WHERE idempotency_key = $1 AND tenant_id = $2`,
      [idempotencyKey, tenantId]
    );

    if (existingWebhook.rows.length > 0) {
      const webhookStatus = existingWebhook.rows[0].status;
      
      // If already processed successfully, return 200 OK without reprocessing
      if (webhookStatus === 'processed') {
        console.log('Duplicate webhook detected (already processed):', idempotencyKey);
        return res.status(200).json({
          success: true,
          message: 'Webhook already processed',
          idempotency_key: idempotencyKey,
        });
      }
      
      // If previously failed, allow retry but log it
      console.log('Retrying previously failed webhook:', idempotencyKey);
    }

    // Log webhook receipt (or update if retrying)
    if (existingWebhook.rows.length === 0) {
      await pool.query(
        `INSERT INTO webhook_logs (
          idempotency_key,
          tenant_id,
          gateway,
          event_type,
          event_id,
          payment_id,
          payload,
          status,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          idempotencyKey,
          tenantId,
          event.gateway,
          event.event_type,
          event.id,
          event.payment_id,
          JSON.stringify(event),
          'received',
        ]
      );
    } else {
      // Update existing failed webhook to retry
      await pool.query(
        `UPDATE webhook_logs 
         SET status = $1, error_message = NULL, payload = $2
         WHERE idempotency_key = $3 AND tenant_id = $4`,
        ['received', JSON.stringify(event), idempotencyKey, tenantId]
      );
    }

    // Process webhook based on event type
    await processWebhookEvent(event, tenantId);

    // Update webhook log status to processed
    await pool.query(
      `UPDATE webhook_logs 
       SET status = $1, processed_at = NOW(), error_message = NULL
       WHERE idempotency_key = $2 AND tenant_id = $3`,
      ['processed', idempotencyKey, tenantId]
    );

    // Return 200 OK
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      idempotency_key: idempotencyKey,
    });
  } catch (error) {
    console.error('Webhook processing error:', error);

    // Log error in webhook_logs if we have the keys
    if (idempotencyKey && tenantId) {
      try {
        await pool.query(
          `UPDATE webhook_logs 
           SET status = $1, error_message = $2
           WHERE idempotency_key = $3 AND tenant_id = $4`,
          ['failed', error.message, idempotencyKey, tenantId]
        );
      } catch (logError) {
        console.error('Failed to log webhook error:', logError);
      }
    }

    // Return 400 for signature/validation errors (no retry)
    if (error.message.includes('signature') || error.message.includes('Invalid')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    // For processing errors, return 500 to trigger gateway retry
    res.status(500).json({
      success: false,
      error: 'Webhook processing failed',
      message: error.message,
    });
  }
});

/**
 * Process webhook event based on type
 */
async function processWebhookEvent(event, tenantId) {
  const pool = getPool();

  // Map gateway-specific event types to common types
  const eventType = normalizeEventType(event.event_type, event.gateway);

  switch (eventType) {
    case 'payment.succeeded':
      await handlePaymentSucceeded(event, tenantId, pool);
      break;

    case 'payment.failed':
      await handlePaymentFailed(event, tenantId, pool);
      break;

    case 'payment.pending':
      await handlePaymentPending(event, tenantId, pool);
      break;

    default:
      console.log('Unhandled webhook event type:', event.event_type);
  }
}

/**
 * Normalize event types across gateways
 */
function normalizeEventType(eventType, gateway) {
  if (gateway === 'razorpay') {
    const mapping = {
      'payment.captured': 'payment.succeeded',
      'payment.failed': 'payment.failed',
      'payment.authorized': 'payment.pending',
    };
    return mapping[eventType] || eventType;
  } else if (gateway === 'stripe') {
    const mapping = {
      'payment_intent.succeeded': 'payment.succeeded',
      'payment_intent.payment_failed': 'payment.failed',
      'payment_intent.processing': 'payment.pending',
    };
    return mapping[eventType] || eventType;
  }
  return eventType;
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(event, tenantId, pool) {
  const studentId = event.metadata?.student_id;

  if (!studentId) {
    console.error('Payment succeeded but missing student_id:', event);
    return;
  }

  // Update or create payment record
  await pool.query(
    `INSERT INTO payments (
      tenant_id,
      student_id,
      gateway,
      payment_id,
      order_id,
      amount,
      currency,
      status,
      payment_method,
      metadata,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    ON CONFLICT (tenant_id, payment_id) 
    DO UPDATE SET
      status = $8,
      updated_at = NOW()`,
    [
      tenantId,
      studentId,
      event.gateway,
      event.payment_id,
      event.order_id || null,
      event.amount,
      event.currency,
      'succeeded',
      event.method || event.payment_method || 'unknown',
      JSON.stringify(event.metadata),
    ]
  );

  console.log('Payment succeeded:', event.payment_id);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(event, tenantId, pool) {
  const studentId = event.metadata?.student_id;

  if (!studentId) {
    console.error('Payment failed but missing student_id:', event);
    return;
  }

  // Update or create payment record
  await pool.query(
    `INSERT INTO payments (
      tenant_id,
      student_id,
      gateway,
      payment_id,
      order_id,
      amount,
      currency,
      status,
      payment_method,
      metadata,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    ON CONFLICT (tenant_id, payment_id) 
    DO UPDATE SET
      status = $8,
      updated_at = NOW()`,
    [
      tenantId,
      studentId,
      event.gateway,
      event.payment_id,
      event.order_id || null,
      event.amount,
      event.currency,
      'failed',
      event.method || event.payment_method || 'unknown',
      JSON.stringify(event.metadata),
    ]
  );

  console.log('Payment failed:', event.payment_id);
}

/**
 * Handle pending payment
 */
async function handlePaymentPending(event, tenantId, pool) {
  const studentId = event.metadata?.student_id;

  if (!studentId) {
    console.error('Payment pending but missing student_id:', event);
    return;
  }

  // Update or create payment record
  await pool.query(
    `INSERT INTO payments (
      tenant_id,
      student_id,
      gateway,
      payment_id,
      order_id,
      amount,
      currency,
      status,
      payment_method,
      metadata,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    ON CONFLICT (tenant_id, payment_id) 
    DO UPDATE SET
      status = $8,
      updated_at = NOW()`,
    [
      tenantId,
      studentId,
      event.gateway,
      event.payment_id,
      event.order_id || null,
      event.amount,
      event.currency,
      'pending',
      event.method || event.payment_method || 'unknown',
      JSON.stringify(event.metadata),
    ]
  );

  console.log('Payment pending:', event.payment_id);
}

/**
 * Health check endpoint for webhooks
 */
router.get('/health', (req, res) => {
  const paymentMethods = paymentService.getSupportedPaymentMethods();

  res.json({
    success: true,
    message: 'Webhook endpoint is healthy',
    test_mode: paymentService.isTestMode(),
    configured: paymentService.isConfigured(),
    supported_gateways: {
      razorpay: paymentMethods.razorpay.available,
      stripe: paymentMethods.stripe.available,
    },
  });
});

/**
 * Get webhook retry statistics
 * 
 * GET /api/v1/webhooks/retry/stats
 */
router.get('/retry/stats', async (req, res) => {
  try {
    const webhookRetryService = require('../services/webhookRetryService');
    const stats = await webhookRetryService.getRetryStatistics();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Failed to get retry statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve retry statistics',
      message: error.message,
    });
  }
});

/**
 * Manually trigger webhook retry processing
 * 
 * POST /api/v1/webhooks/retry/process
 * 
 * Note: This is typically handled by a scheduled job,
 * but can be manually triggered for testing or emergency processing
 */
router.post('/retry/process', async (req, res) => {
  try {
    const webhookRetryService = require('../services/webhookRetryService');
    const summary = await webhookRetryService.processRetries();

    res.json({
      success: true,
      message: 'Webhook retry processing completed',
      data: summary,
    });
  } catch (error) {
    console.error('Failed to process webhook retries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process webhook retries',
      message: error.message,
    });
  }
});

module.exports = router;
