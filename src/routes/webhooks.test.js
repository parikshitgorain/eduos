/**
 * Webhook Routes Tests
 */

const request = require('supertest');
const express = require('express');
const webhookRoutes = require('./webhooks');

// Mock payment service
jest.mock('../services/paymentService', () => ({
  parseWebhookEvent: jest.fn(),
  getSupportedPaymentMethods: jest.fn(),
  isTestMode: jest.fn(),
  isConfigured: jest.fn(),
}));

// Mock database
jest.mock('../config/database', () => ({
  getPool: jest.fn(() => ({
    query: jest.fn(),
  })),
}));

const paymentService = require('../services/paymentService');
const { getPool } = require('../config/database');

// Create test app
const app = express();
app.use('/api/v1/webhooks', webhookRoutes);

describe('Webhook Routes', () => {
  let mockPool;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPool = {
      query: jest.fn(),
    };
    getPool.mockReturnValue(mockPool);
  });

  describe('POST /api/v1/webhooks/payments', () => {
    it('should process Razorpay webhook successfully', async () => {
      const webhookPayload = {
        event: 'payment.captured',
        created_at: 1234567890,
        payload: {
          payment: {
            entity: {
              id: 'pay_test_123',
              order_id: 'order_test_123',
              amount: 10000,
              currency: 'INR',
              status: 'captured',
              method: 'upi',
              notes: { tenant_id: 'tenant-123', student_id: 'student-456' },
            },
          },
        },
      };

      const parsedEvent = {
        gateway: 'razorpay',
        id: 'evt_test_123',
        event_type: 'payment.captured',
        payment_id: 'pay_test_123',
        order_id: 'order_test_123',
        amount: 10000,
        currency: 'INR',
        status: 'captured',
        method: 'upi',
        metadata: { tenant_id: 'tenant-123', student_id: 'student-456' },
      };

      paymentService.parseWebhookEvent.mockReturnValue(parsedEvent);

      // Mock database queries
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // Check for existing webhook
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Insert webhook log
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Insert payment
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Update webhook status

      const response = await request(app)
        .post('/api/v1/webhooks/payments')
        .set('x-razorpay-signature', 'valid_signature')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Webhook processed successfully');
      expect(paymentService.parseWebhookEvent).toHaveBeenCalled();
    });

    it('should reject duplicate webhook', async () => {
      const webhookPayload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_123',
              notes: { tenant_id: 'tenant-123' },
            },
          },
        },
      };

      const parsedEvent = {
        gateway: 'razorpay',
        id: 'evt_test_123',
        event_type: 'payment.captured',
        payment_id: 'pay_test_123',
        metadata: { tenant_id: 'tenant-123' },
      };

      paymentService.parseWebhookEvent.mockReturnValue(parsedEvent);

      // Mock existing webhook with 'processed' status (not 'failed')
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'processed' }] });

      const response = await request(app)
        .post('/api/v1/webhooks/payments')
        .set('x-razorpay-signature', 'valid_signature')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Webhook already processed');
    });

    it('should reject webhook without signature', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/payments')
        .send({ event: 'payment.captured' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing webhook signature');
    });

    it('should reject webhook without tenant_id', async () => {
      const webhookPayload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_123',
              notes: {}, // Missing tenant_id
            },
          },
        },
      };

      const parsedEvent = {
        gateway: 'razorpay',
        id: 'evt_test_123',
        event_type: 'payment.captured',
        payment_id: 'pay_test_123',
        metadata: {}, // Missing tenant_id
      };

      paymentService.parseWebhookEvent.mockReturnValue(parsedEvent);

      const response = await request(app)
        .post('/api/v1/webhooks/payments')
        .set('x-razorpay-signature', 'valid_signature')
        .send(webhookPayload);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing tenant_id in webhook metadata');
    });

    it('should handle invalid signature', async () => {
      paymentService.parseWebhookEvent.mockImplementation(() => {
        throw new Error('Invalid webhook signature');
      });

      const response = await request(app)
        .post('/api/v1/webhooks/payments')
        .set('x-razorpay-signature', 'invalid_signature')
        .send({ event: 'payment.captured' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should process Stripe webhook successfully', async () => {
      const webhookPayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123',
            amount: 10000,
            currency: 'inr',
            status: 'succeeded',
            metadata: { tenant_id: 'tenant-123', student_id: 'student-456' },
          },
        },
      };

      const parsedEvent = {
        gateway: 'stripe',
        id: 'evt_test_123',
        event_type: 'payment_intent.succeeded',
        payment_id: 'pi_test_123',
        amount: 10000,
        currency: 'INR',
        status: 'succeeded',
        metadata: { tenant_id: 'tenant-123', student_id: 'student-456' },
      };

      paymentService.parseWebhookEvent.mockReturnValue(parsedEvent);

      // Mock database queries
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // Check for existing webhook
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Insert webhook log
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Insert payment
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Update webhook status

      const response = await request(app)
        .post('/api/v1/webhooks/payments')
        .set('stripe-signature', 'valid_signature')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/webhooks/health', () => {
    it('should return webhook health status', async () => {
      const mockMethods = {
        razorpay: { available: true },
        stripe: { available: true },
      };

      paymentService.getSupportedPaymentMethods.mockReturnValue(mockMethods);
      paymentService.isTestMode.mockReturnValue(true);
      paymentService.isConfigured.mockReturnValue(true);

      const response = await request(app)
        .get('/api/v1/webhooks/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.test_mode).toBe(true);
      expect(response.body.configured).toBe(true);
      expect(response.body.supported_gateways.razorpay).toBe(true);
      expect(response.body.supported_gateways.stripe).toBe(true);
    });
  });

  describe('GET /api/v1/webhooks/retry/stats', () => {
    it('should return retry statistics', async () => {
      // Mock database query for retry statistics
      mockPool.query.mockResolvedValue({
        rows: [{
          pending_retries: '5',
          max_retries_exceeded: '2',
          successful_retries: '10',
          avg_retries_to_success: '2.5',
        }],
      });

      const response = await request(app)
        .get('/api/v1/webhooks/retry/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.pending_retries).toBe(5);
    });
  });

  describe('POST /api/v1/webhooks/retry/process', () => {
    it('should manually trigger retry processing', async () => {
      // Mock getWebhooksForRetry - return empty array (no webhooks to retry)
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/v1/webhooks/retry/process');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.total).toBe(0);
    });
  });

  describe('Payment Event Handlers', () => {
    it('should handle payment.failed event', async () => {
      const webhookPayload = {
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_failed',
              order_id: 'order_test_123',
              amount: 10000,
              currency: 'INR',
              status: 'failed',
              method: 'card',
              notes: { tenant_id: 'tenant-123', student_id: 'student-456' },
            },
          },
        },
      };

      const parsedEvent = {
        gateway: 'razorpay',
        id: 'evt_test_failed',
        event_type: 'payment.failed',
        payment_id: 'pay_test_failed',
        order_id: 'order_test_123',
        amount: 10000,
        currency: 'INR',
        status: 'failed',
        method: 'card',
        metadata: { tenant_id: 'tenant-123', student_id: 'student-456' },
      };

      paymentService.parseWebhookEvent.mockReturnValue(parsedEvent);

      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .post('/api/v1/webhooks/payments')
        .set('x-razorpay-signature', 'valid_signature')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle payment.pending event', async () => {
      const webhookPayload = {
        event: 'payment.authorized',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_pending',
              order_id: 'order_test_123',
              amount: 10000,
              currency: 'INR',
              status: 'authorized',
              method: 'netbanking',
              notes: { tenant_id: 'tenant-123', student_id: 'student-456' },
            },
          },
        },
      };

      const parsedEvent = {
        gateway: 'razorpay',
        id: 'evt_test_pending',
        event_type: 'payment.authorized',
        payment_id: 'pay_test_pending',
        order_id: 'order_test_123',
        amount: 10000,
        currency: 'INR',
        status: 'authorized',
        method: 'netbanking',
        metadata: { tenant_id: 'tenant-123', student_id: 'student-456' },
      };

      paymentService.parseWebhookEvent.mockReturnValue(parsedEvent);

      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .post('/api/v1/webhooks/payments')
        .set('x-razorpay-signature', 'valid_signature')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle unhandled event types gracefully', async () => {
      const webhookPayload = {
        event: 'payment.refunded',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_refund',
              notes: { tenant_id: 'tenant-123' },
            },
          },
        },
      };

      const parsedEvent = {
        gateway: 'razorpay',
        id: 'evt_test_refund',
        event_type: 'payment.refunded',
        payment_id: 'pay_test_refund',
        metadata: { tenant_id: 'tenant-123' },
      };

      paymentService.parseWebhookEvent.mockReturnValue(parsedEvent);

      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .post('/api/v1/webhooks/payments')
        .set('x-razorpay-signature', 'valid_signature')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle payment succeeded without student_id', async () => {
      const webhookPayload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_no_student',
              amount: 10000,
              currency: 'INR',
              notes: { tenant_id: 'tenant-123' },
            },
          },
        },
      };

      const parsedEvent = {
        gateway: 'razorpay',
        id: 'evt_test_no_student',
        event_type: 'payment.captured',
        payment_id: 'pay_test_no_student',
        amount: 10000,
        currency: 'INR',
        metadata: { tenant_id: 'tenant-123' },
      };

      paymentService.parseWebhookEvent.mockReturnValue(parsedEvent);

      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .post('/api/v1/webhooks/payments')
        .set('x-razorpay-signature', 'valid_signature')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle payment failed without student_id', async () => {
      const webhookPayload = {
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_failed_no_student',
              amount: 10000,
              currency: 'INR',
              notes: { tenant_id: 'tenant-123' },
            },
          },
        },
      };

      const parsedEvent = {
        gateway: 'razorpay',
        id: 'evt_test_failed_no_student',
        event_type: 'payment.failed',
        payment_id: 'pay_test_failed_no_student',
        amount: 10000,
        currency: 'INR',
        metadata: { tenant_id: 'tenant-123' },
      };

      paymentService.parseWebhookEvent.mockReturnValue(parsedEvent);

      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .post('/api/v1/webhooks/payments')
        .set('x-razorpay-signature', 'valid_signature')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle payment pending without student_id', async () => {
      const webhookPayload = {
        event: 'payment.authorized',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_pending_no_student',
              amount: 10000,
              currency: 'INR',
              notes: { tenant_id: 'tenant-123' },
            },
          },
        },
      };

      const parsedEvent = {
        gateway: 'razorpay',
        id: 'evt_test_pending_no_student',
        event_type: 'payment.authorized',
        payment_id: 'pay_test_pending_no_student',
        amount: 10000,
        currency: 'INR',
        metadata: { tenant_id: 'tenant-123' },
      };

      paymentService.parseWebhookEvent.mockReturnValue(parsedEvent);

      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .post('/api/v1/webhooks/payments')
        .set('x-razorpay-signature', 'valid_signature')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors during webhook processing', async () => {
      const webhookPayload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_db_error',
              notes: { tenant_id: 'tenant-123', student_id: 'student-456' },
            },
          },
        },
      };

      const parsedEvent = {
        gateway: 'razorpay',
        id: 'evt_test_db_error',
        event_type: 'payment.captured',
        payment_id: 'pay_test_db_error',
        metadata: { tenant_id: 'tenant-123', student_id: 'student-456' },
      };

      paymentService.parseWebhookEvent.mockReturnValue(parsedEvent);
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/v1/webhooks/payments')
        .set('x-razorpay-signature', 'valid_signature')
        .send(webhookPayload);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Webhook processing failed');
    });

    it('should allow retry of previously failed webhook', async () => {
      const webhookPayload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_retry',
              notes: { tenant_id: 'tenant-123', student_id: 'student-456' },
            },
          },
        },
      };

      const parsedEvent = {
        gateway: 'razorpay',
        id: 'evt_test_retry',
        event_type: 'payment.captured',
        payment_id: 'pay_test_retry',
        metadata: { tenant_id: 'tenant-123', student_id: 'student-456' },
      };

      paymentService.parseWebhookEvent.mockReturnValue(parsedEvent);

      // Mock existing failed webhook
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'failed' }] }) // Check existing
        .mockResolvedValueOnce({ rows: [] }) // Update to retry
        .mockResolvedValueOnce({ rows: [] }) // Process payment
        .mockResolvedValueOnce({ rows: [] }); // Mark as processed

      const response = await request(app)
        .post('/api/v1/webhooks/payments')
        .set('x-razorpay-signature', 'valid_signature')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Webhook processed successfully');
    });

    it('should store error message on webhook failure', async () => {
      const webhookPayload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_error',
              notes: { tenant_id: 'tenant-123', student_id: 'student-456' },
            },
          },
        },
      };

      const parsedEvent = {
        gateway: 'razorpay',
        id: 'evt_test_error',
        event_type: 'payment.captured',
        payment_id: 'pay_test_error',
        metadata: { tenant_id: 'tenant-123', student_id: 'student-456' },
      };

      paymentService.parseWebhookEvent.mockReturnValue(parsedEvent);

      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing
        .mockResolvedValueOnce({ rows: [] }) // Insert webhook log
        .mockRejectedValueOnce(new Error('Payment processing failed')) // Processing fails
        .mockResolvedValueOnce({ rows: [] }); // Update with error

      const response = await request(app)
        .post('/api/v1/webhooks/payments')
        .set('x-razorpay-signature', 'valid_signature')
        .send(webhookPayload);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      // Verify error was logged
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE webhook_logs'),
        expect.arrayContaining(['failed', 'Payment processing failed'])
      );
    });

    it('should handle Stripe payment_intent.payment_failed event', async () => {
      const webhookPayload = {
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_test_failed',
            amount: 10000,
            currency: 'inr',
            status: 'failed',
            metadata: { tenant_id: 'tenant-123', student_id: 'student-456' },
          },
        },
      };

      const parsedEvent = {
        gateway: 'stripe',
        id: 'evt_test_failed',
        event_type: 'payment_intent.payment_failed',
        payment_id: 'pi_test_failed',
        amount: 10000,
        currency: 'INR',
        status: 'failed',
        metadata: { tenant_id: 'tenant-123', student_id: 'student-456' },
      };

      paymentService.parseWebhookEvent.mockReturnValue(parsedEvent);

      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .post('/api/v1/webhooks/payments')
        .set('stripe-signature', 'valid_signature')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle Stripe payment_intent.processing event', async () => {
      const webhookPayload = {
        type: 'payment_intent.processing',
        data: {
          object: {
            id: 'pi_test_processing',
            amount: 10000,
            currency: 'inr',
            status: 'processing',
            metadata: { tenant_id: 'tenant-123', student_id: 'student-456' },
          },
        },
      };

      const parsedEvent = {
        gateway: 'stripe',
        id: 'evt_test_processing',
        event_type: 'payment_intent.processing',
        payment_id: 'pi_test_processing',
        amount: 10000,
        currency: 'INR',
        status: 'processing',
        metadata: { tenant_id: 'tenant-123', student_id: 'student-456' },
      };

      paymentService.parseWebhookEvent.mockReturnValue(parsedEvent);

      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .post('/api/v1/webhooks/payments')
        .set('stripe-signature', 'valid_signature')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle unknown gateway event type normalization', async () => {
      const webhookPayload = {
        event: 'payment.unknown',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_unknown',
              notes: { tenant_id: 'tenant-123', student_id: 'student-456' },
            },
          },
        },
      };

      const parsedEvent = {
        gateway: 'unknown_gateway',
        id: 'evt_test_unknown',
        event_type: 'payment.unknown',
        payment_id: 'pay_test_unknown',
        metadata: { tenant_id: 'tenant-123', student_id: 'student-456' },
      };

      paymentService.parseWebhookEvent.mockReturnValue(parsedEvent);

      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .post('/api/v1/webhooks/payments')
        .set('x-razorpay-signature', 'valid_signature')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
