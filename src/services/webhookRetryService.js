/**
 * Webhook Retry Service
 * 
 * Implements exponential backoff retry logic for failed webhooks
 * Retry schedule:
 * - Attempt 1: Immediate (handled by gateway)
 * - Attempt 2: 1 minute later
 * - Attempt 3: 5 minutes later
 * - Attempt 4: 15 minutes later
 * - Attempt 5: 1 hour later
 * - Attempt 6: 6 hours later
 * - Attempt 7: 24 hours later (final attempt)
 */

const { getPool } = require('../config/database');
const paymentService = require('./paymentService');

class WebhookRetryService {
  constructor() {
    this.maxRetries = 7;
    this.retrySchedule = [
      0,           // Immediate (gateway handles)
      60,          // 1 minute
      300,         // 5 minutes
      900,         // 15 minutes
      3600,        // 1 hour
      21600,       // 6 hours
      86400,       // 24 hours
    ];
  }

  /**
   * Get retry delay in seconds for a given attempt number
   * 
   * @param {number} attemptNumber - Current attempt number (1-based)
   * @returns {number} Delay in seconds
   */
  getRetryDelay(attemptNumber) {
    if (attemptNumber <= 0 || attemptNumber > this.retrySchedule.length) {
      return 0;
    }
    return this.retrySchedule[attemptNumber - 1];
  }

  /**
   * Calculate next retry time based on attempt number
   * 
   * @param {number} attemptNumber - Current attempt number
   * @returns {Date} Next retry time
   */
  calculateNextRetryTime(attemptNumber) {
    const delaySeconds = this.getRetryDelay(attemptNumber);
    const nextRetry = new Date();
    nextRetry.setSeconds(nextRetry.getSeconds() + delaySeconds);
    return nextRetry;
  }

  /**
   * Get failed webhooks that are ready for retry
   * 
   * @returns {Promise<Array>} Array of webhook logs ready for retry
   */
  async getWebhooksForRetry() {
    const pool = getPool();

    // Get failed webhooks where:
    // 1. Status is 'failed'
    // 2. Retry count < max retries
    // 3. Next retry time has passed (or is null for first retry)
    const result = await pool.query(
      `SELECT 
        id,
        idempotency_key,
        tenant_id,
        gateway,
        event_type,
        event_id,
        payment_id,
        payload,
        retry_count,
        error_message,
        created_at
       FROM webhook_logs
       WHERE status = 'failed'
         AND (retry_count IS NULL OR retry_count < $1)
         AND (next_retry_at IS NULL OR next_retry_at <= NOW())
       ORDER BY created_at ASC
       LIMIT 100`,
      [this.maxRetries]
    );

    return result.rows;
  }

  /**
   * Retry a failed webhook
   * 
   * @param {Object} webhookLog - Webhook log record
   * @returns {Promise<Object>} Retry result
   */
  async retryWebhook(webhookLog) {
    const pool = getPool();
    const currentRetryCount = webhookLog.retry_count || 0;
    const nextRetryCount = currentRetryCount + 1;

    try {
      console.log(`Retrying webhook ${webhookLog.idempotency_key}, attempt ${nextRetryCount}`);

      // Parse the stored payload
      const event = typeof webhookLog.payload === 'string' 
        ? JSON.parse(webhookLog.payload) 
        : webhookLog.payload;

      // Update retry count and status
      await pool.query(
        `UPDATE webhook_logs 
         SET retry_count = $1, status = 'received', last_retry_at = NOW()
         WHERE id = $2`,
        [nextRetryCount, webhookLog.id]
      );

      // Process the webhook event
      await this.processWebhookEvent(event, webhookLog.tenant_id);

      // Mark as processed
      await pool.query(
        `UPDATE webhook_logs 
         SET status = 'processed', processed_at = NOW(), error_message = NULL, next_retry_at = NULL
         WHERE id = $1`,
        [webhookLog.id]
      );

      console.log(`Webhook ${webhookLog.idempotency_key} processed successfully on retry ${nextRetryCount}`);

      return {
        success: true,
        idempotency_key: webhookLog.idempotency_key,
        retry_count: nextRetryCount,
      };
    } catch (error) {
      console.error(`Webhook retry failed for ${webhookLog.idempotency_key}:`, error);

      // Calculate next retry time if we haven't exceeded max retries
      let nextRetryAt = null;
      if (nextRetryCount < this.maxRetries) {
        nextRetryAt = this.calculateNextRetryTime(nextRetryCount + 1);
      }

      // Update webhook log with error and next retry time
      await pool.query(
        `UPDATE webhook_logs 
         SET status = 'failed', 
             error_message = $1, 
             retry_count = $2,
             next_retry_at = $3
         WHERE id = $4`,
        [error.message, nextRetryCount, nextRetryAt, webhookLog.id]
      );

      return {
        success: false,
        idempotency_key: webhookLog.idempotency_key,
        retry_count: nextRetryCount,
        error: error.message,
        next_retry_at: nextRetryAt,
      };
    }
  }

  /**
   * Process webhook event (same logic as in webhooks.js)
   * 
   * @param {Object} event - Webhook event
   * @param {string} tenantId - Tenant ID
   */
  async processWebhookEvent(event, tenantId) {
    const pool = getPool();

    // Map gateway-specific event types to common types
    const eventType = this.normalizeEventType(event.event_type, event.gateway);

    switch (eventType) {
      case 'payment.succeeded':
        await this.handlePaymentSucceeded(event, tenantId, pool);
        break;

      case 'payment.failed':
        await this.handlePaymentFailed(event, tenantId, pool);
        break;

      case 'payment.pending':
        await this.handlePaymentPending(event, tenantId, pool);
        break;

      default:
        console.log('Unhandled webhook event type:', event.event_type);
    }
  }

  /**
   * Normalize event types across gateways
   */
  normalizeEventType(eventType, gateway) {
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
  async handlePaymentSucceeded(event, tenantId, pool) {
    const studentId = event.metadata?.student_id;

    if (!studentId) {
      console.error('Payment succeeded but missing student_id:', event);
      return;
    }

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
  }

  /**
   * Handle failed payment
   */
  async handlePaymentFailed(event, tenantId, pool) {
    const studentId = event.metadata?.student_id;

    if (!studentId) {
      console.error('Payment failed but missing student_id:', event);
      return;
    }

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
  }

  /**
   * Handle pending payment
   */
  async handlePaymentPending(event, tenantId, pool) {
    const studentId = event.metadata?.student_id;

    if (!studentId) {
      console.error('Payment pending but missing student_id:', event);
      return;
    }

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
  }

  /**
   * Process all failed webhooks ready for retry
   * 
   * @returns {Promise<Object>} Summary of retry results
   */
  async processRetries() {
    const webhooks = await this.getWebhooksForRetry();

    if (webhooks.length === 0) {
      return {
        total: 0,
        successful: 0,
        failed: 0,
      };
    }

    console.log(`Processing ${webhooks.length} failed webhooks for retry`);

    const results = await Promise.allSettled(
      webhooks.map(webhook => this.retryWebhook(webhook))
    );

    const summary = {
      total: webhooks.length,
      successful: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
      failed: results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length,
    };

    console.log(`Webhook retry summary:`, summary);

    return summary;
  }

  /**
   * Get webhook retry statistics
   * 
   * @returns {Promise<Object>} Retry statistics
   */
  async getRetryStatistics() {
    const pool = getPool();

    const result = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'failed' AND retry_count < $1) as pending_retries,
        COUNT(*) FILTER (WHERE status = 'failed' AND retry_count >= $1) as max_retries_exceeded,
        COUNT(*) FILTER (WHERE status = 'processed' AND retry_count > 0) as successful_retries,
        AVG(retry_count) FILTER (WHERE status = 'processed' AND retry_count > 0) as avg_retries_to_success
       FROM webhook_logs
       WHERE created_at > NOW() - INTERVAL '7 days'`,
      [this.maxRetries]
    );

    return {
      pending_retries: parseInt(result.rows[0].pending_retries) || 0,
      max_retries_exceeded: parseInt(result.rows[0].max_retries_exceeded) || 0,
      successful_retries: parseInt(result.rows[0].successful_retries) || 0,
      avg_retries_to_success: parseFloat(result.rows[0].avg_retries_to_success) || 0,
      max_retry_attempts: this.maxRetries,
      retry_schedule_seconds: this.retrySchedule,
    };
  }
}

// Export singleton instance
module.exports = new WebhookRetryService();
