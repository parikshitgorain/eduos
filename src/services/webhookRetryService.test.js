/**
 * Webhook Retry Service Tests
 */

const webhookRetryService = require('./webhookRetryService');

// Mock database
jest.mock('../config/database', () => ({
  getPool: jest.fn(() => ({
    query: jest.fn(),
  })),
}));

const { getPool } = require('../config/database');

describe('WebhookRetryService', () => {
  let mockPool;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPool = {
      query: jest.fn(),
    };
    getPool.mockReturnValue(mockPool);
  });

  describe('getRetryDelay', () => {
    it('should return correct delay for each attempt', () => {
      expect(webhookRetryService.getRetryDelay(1)).toBe(0); // Immediate
      expect(webhookRetryService.getRetryDelay(2)).toBe(60); // 1 minute
      expect(webhookRetryService.getRetryDelay(3)).toBe(300); // 5 minutes
      expect(webhookRetryService.getRetryDelay(4)).toBe(900); // 15 minutes
      expect(webhookRetryService.getRetryDelay(5)).toBe(3600); // 1 hour
      expect(webhookRetryService.getRetryDelay(6)).toBe(21600); // 6 hours
      expect(webhookRetryService.getRetryDelay(7)).toBe(86400); // 24 hours
    });

    it('should return 0 for invalid attempt numbers', () => {
      expect(webhookRetryService.getRetryDelay(0)).toBe(0);
      expect(webhookRetryService.getRetryDelay(8)).toBe(0);
      expect(webhookRetryService.getRetryDelay(-1)).toBe(0);
    });
  });

  describe('calculateNextRetryTime', () => {
    it('should calculate correct next retry time', () => {
      const now = new Date();
      const nextRetry = webhookRetryService.calculateNextRetryTime(2);
      
      // Should be approximately 60 seconds from now
      const diffSeconds = Math.floor((nextRetry - now) / 1000);
      expect(diffSeconds).toBeGreaterThanOrEqual(59);
      expect(diffSeconds).toBeLessThanOrEqual(61);
    });

    it('should handle immediate retry', () => {
      const now = new Date();
      const nextRetry = webhookRetryService.calculateNextRetryTime(1);
      
      // Should be approximately now (0 seconds delay)
      const diffSeconds = Math.floor((nextRetry - now) / 1000);
      expect(diffSeconds).toBeLessThanOrEqual(1);
    });
  });

  describe('getWebhooksForRetry', () => {
    it('should retrieve failed webhooks ready for retry', async () => {
      const mockWebhooks = [
        {
          id: 'webhook-1',
          idempotency_key: 'evt_123_tenant-1',
          tenant_id: 'tenant-1',
          gateway: 'razorpay',
          event_type: 'payment.captured',
          retry_count: 1,
          payload: { test: 'data' },
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockWebhooks });

      const result = await webhookRetryService.getWebhooksForRetry();

      expect(result).toEqual(mockWebhooks);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = \'failed\''),
        [7] // max retries
      );
    });

    it('should return empty array when no webhooks need retry', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await webhookRetryService.getWebhooksForRetry();

      expect(result).toEqual([]);
    });
  });

  describe('retryWebhook', () => {
    it('should successfully retry a failed webhook', async () => {
      const webhookLog = {
        id: 'webhook-1',
        idempotency_key: 'evt_123_tenant-1',
        tenant_id: 'tenant-1',
        gateway: 'razorpay',
        event_type: 'payment.captured',
        payment_id: 'pay_123',
        retry_count: 1,
        payload: {
          gateway: 'razorpay',
          event_type: 'payment.captured',
          payment_id: 'pay_123',
          amount: 10000,
          currency: 'INR',
          metadata: {
            tenant_id: 'tenant-1',
            student_id: 'student-1',
          },
        },
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // Update retry count
        .mockResolvedValueOnce({ rows: [] }) // Insert payment
        .mockResolvedValueOnce({ rows: [] }); // Mark as processed

      const result = await webhookRetryService.retryWebhook(webhookLog);

      expect(result.success).toBe(true);
      expect(result.retry_count).toBe(2);
      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });

    it('should handle retry failure and schedule next retry', async () => {
      const webhookLog = {
        id: 'webhook-1',
        idempotency_key: 'evt_123_tenant-1',
        tenant_id: 'tenant-1',
        gateway: 'razorpay',
        event_type: 'payment.captured',
        retry_count: 1,
        payload: {
          gateway: 'razorpay',
          event_type: 'payment.captured',
          payment_id: 'pay_123',
          metadata: {
            tenant_id: 'tenant-1',
            student_id: 'student-1',
          },
        },
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // Update retry count
        .mockRejectedValueOnce(new Error('Database error')) // Processing fails
        .mockResolvedValueOnce({ rows: [] }); // Update with error

      const result = await webhookRetryService.retryWebhook(webhookLog);

      expect(result.success).toBe(false);
      expect(result.retry_count).toBe(2);
      expect(result.error).toBe('Database error');
      expect(result.next_retry_at).toBeDefined();
    });

    it('should not schedule next retry after max retries', async () => {
      const webhookLog = {
        id: 'webhook-1',
        idempotency_key: 'evt_123_tenant-1',
        tenant_id: 'tenant-1',
        gateway: 'razorpay',
        event_type: 'payment.captured',
        retry_count: 6, // One before max
        payload: {
          gateway: 'razorpay',
          event_type: 'payment.captured',
          payment_id: 'pay_123',
          metadata: {
            tenant_id: 'tenant-1',
            student_id: 'student-1',
          },
        },
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // Update retry count
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({ rows: [] }); // Update with error

      const result = await webhookRetryService.retryWebhook(webhookLog);

      expect(result.success).toBe(false);
      expect(result.retry_count).toBe(7);
      expect(result.next_retry_at).toBeNull(); // No more retries
    });

    it('should handle JSON string payload', async () => {
      const webhookLog = {
        id: 'webhook-1',
        idempotency_key: 'evt_123_tenant-1',
        tenant_id: 'tenant-1',
        gateway: 'razorpay',
        event_type: 'payment.captured',
        retry_count: 0,
        payload: JSON.stringify({
          gateway: 'razorpay',
          event_type: 'payment.captured',
          payment_id: 'pay_123',
          metadata: {
            tenant_id: 'tenant-1',
            student_id: 'student-1',
          },
        }),
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await webhookRetryService.retryWebhook(webhookLog);

      expect(result.success).toBe(true);
    });
  });

  describe('processRetries', () => {
    it('should process multiple failed webhooks', async () => {
      const mockWebhooks = [
        {
          id: 'webhook-1',
          idempotency_key: 'evt_123_tenant-1',
          tenant_id: 'tenant-1',
          gateway: 'razorpay',
          event_type: 'payment.captured',
          retry_count: 1,
          payload: {
            gateway: 'razorpay',
            event_type: 'payment.captured',
            payment_id: 'pay_123',
            metadata: { tenant_id: 'tenant-1', student_id: 'student-1' },
          },
        },
        {
          id: 'webhook-2',
          idempotency_key: 'evt_456_tenant-1',
          tenant_id: 'tenant-1',
          gateway: 'stripe',
          event_type: 'payment_intent.succeeded',
          retry_count: 0,
          payload: {
            gateway: 'stripe',
            event_type: 'payment_intent.succeeded',
            payment_id: 'pi_456',
            metadata: { tenant_id: 'tenant-1', student_id: 'student-2' },
          },
        },
      ];

      // Mock getWebhooksForRetry
      mockPool.query.mockResolvedValueOnce({ rows: mockWebhooks });

      // Mock successful retries
      mockPool.query
        .mockResolvedValue({ rows: [] }); // All subsequent queries succeed

      const summary = await webhookRetryService.processRetries();

      expect(summary.total).toBe(2);
      expect(summary.successful).toBe(2);
      expect(summary.failed).toBe(0);
    });

    it('should return zero summary when no webhooks to retry', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const summary = await webhookRetryService.processRetries();

      expect(summary.total).toBe(0);
      expect(summary.successful).toBe(0);
      expect(summary.failed).toBe(0);
    });

    it('should handle mixed success and failure', async () => {
      const mockWebhooks = [
        {
          id: 'webhook-1',
          idempotency_key: 'evt_123_tenant-1',
          tenant_id: 'tenant-1',
          gateway: 'razorpay',
          event_type: 'payment.captured',
          retry_count: 1,
          payload: {
            gateway: 'razorpay',
            event_type: 'payment.captured',
            payment_id: 'pay_123',
            metadata: { tenant_id: 'tenant-1', student_id: 'student-1' },
          },
        },
        {
          id: 'webhook-2',
          idempotency_key: 'evt_456_tenant-1',
          tenant_id: 'tenant-1',
          gateway: 'razorpay',
          event_type: 'payment.captured',
          retry_count: 1,
          payload: {
            gateway: 'razorpay',
            event_type: 'payment.captured',
            payment_id: 'pay_456',
            metadata: { tenant_id: 'tenant-1', student_id: 'student-2' },
          },
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockWebhooks });

      // First webhook succeeds
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      // Second webhook fails
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockResolvedValueOnce({ rows: [] });

      const summary = await webhookRetryService.processRetries();

      expect(summary.total).toBe(2);
      expect(summary.successful).toBe(1);
      expect(summary.failed).toBe(1);
    });
  });

  describe('getRetryStatistics', () => {
    it('should return retry statistics', async () => {
      const mockStats = {
        pending_retries: '5',
        max_retries_exceeded: '2',
        successful_retries: '10',
        avg_retries_to_success: '2.5',
      };

      mockPool.query.mockResolvedValue({ rows: [mockStats] });

      const stats = await webhookRetryService.getRetryStatistics();

      expect(stats.pending_retries).toBe(5);
      expect(stats.max_retries_exceeded).toBe(2);
      expect(stats.successful_retries).toBe(10);
      expect(stats.avg_retries_to_success).toBe(2.5);
      expect(stats.max_retry_attempts).toBe(7);
      expect(stats.retry_schedule_seconds).toHaveLength(7);
    });

    it('should handle null statistics', async () => {
      const mockStats = {
        pending_retries: null,
        max_retries_exceeded: null,
        successful_retries: null,
        avg_retries_to_success: null,
      };

      mockPool.query.mockResolvedValue({ rows: [mockStats] });

      const stats = await webhookRetryService.getRetryStatistics();

      expect(stats.pending_retries).toBe(0);
      expect(stats.max_retries_exceeded).toBe(0);
      expect(stats.successful_retries).toBe(0);
      expect(stats.avg_retries_to_success).toBe(0);
    });
  });

  describe('Event Processing', () => {
    it('should normalize Razorpay event types', () => {
      expect(webhookRetryService.normalizeEventType('payment.captured', 'razorpay')).toBe('payment.succeeded');
      expect(webhookRetryService.normalizeEventType('payment.failed', 'razorpay')).toBe('payment.failed');
      expect(webhookRetryService.normalizeEventType('payment.authorized', 'razorpay')).toBe('payment.pending');
    });

    it('should normalize Stripe event types', () => {
      expect(webhookRetryService.normalizeEventType('payment_intent.succeeded', 'stripe')).toBe('payment.succeeded');
      expect(webhookRetryService.normalizeEventType('payment_intent.payment_failed', 'stripe')).toBe('payment.failed');
      expect(webhookRetryService.normalizeEventType('payment_intent.processing', 'stripe')).toBe('payment.pending');
    });

    it('should return original event type for unknown mappings', () => {
      expect(webhookRetryService.normalizeEventType('payment.refunded', 'razorpay')).toBe('payment.refunded');
      expect(webhookRetryService.normalizeEventType('unknown.event', 'stripe')).toBe('unknown.event');
    });
  });

  describe('Payment Handlers', () => {
    it('should handle payment succeeded', async () => {
      const event = {
        gateway: 'razorpay',
        payment_id: 'pay_123',
        order_id: 'order_123',
        amount: 10000,
        currency: 'INR',
        method: 'upi',
        metadata: {
          tenant_id: 'tenant-1',
          student_id: 'student-1',
        },
      };

      mockPool.query.mockResolvedValue({ rows: [] });

      await webhookRetryService.handlePaymentSucceeded(event, 'tenant-1', mockPool);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payments'),
        expect.arrayContaining(['tenant-1', 'student-1', 'razorpay', 'pay_123'])
      );
    });

    it('should skip payment succeeded without student_id', async () => {
      const event = {
        gateway: 'razorpay',
        payment_id: 'pay_123',
        metadata: {
          tenant_id: 'tenant-1',
        },
      };

      await webhookRetryService.handlePaymentSucceeded(event, 'tenant-1', mockPool);

      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should handle payment failed', async () => {
      const event = {
        gateway: 'stripe',
        payment_id: 'pi_123',
        amount: 10000,
        currency: 'INR',
        metadata: {
          tenant_id: 'tenant-1',
          student_id: 'student-1',
        },
      };

      mockPool.query.mockResolvedValue({ rows: [] });

      await webhookRetryService.handlePaymentFailed(event, 'tenant-1', mockPool);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payments'),
        expect.arrayContaining(['tenant-1', 'student-1', 'stripe', 'pi_123'])
      );
    });

    it('should handle payment pending', async () => {
      const event = {
        gateway: 'razorpay',
        payment_id: 'pay_123',
        amount: 10000,
        currency: 'INR',
        method: 'netbanking',
        metadata: {
          tenant_id: 'tenant-1',
          student_id: 'student-1',
        },
      };

      mockPool.query.mockResolvedValue({ rows: [] });

      await webhookRetryService.handlePaymentPending(event, 'tenant-1', mockPool);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payments'),
        expect.arrayContaining(['tenant-1', 'student-1', 'razorpay', 'pay_123'])
      );
    });
  });
});
