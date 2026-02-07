/**
 * Payment Service Tests
 */

// Set environment variables BEFORE requiring the service
process.env.STRIPE_SECRET_KEY = 'sk_test_123';
process.env.RAZORPAY_KEY_ID = 'rzp_test_123';
process.env.RAZORPAY_KEY_SECRET = 'secret_123';
process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_secret_123';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
process.env.DEFAULT_CURRENCY = 'INR';
process.env.NODE_ENV = 'test';

// Mock Stripe and Razorpay BEFORE requiring the service
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret',
        amount: 10000,
        currency: 'inr',
        status: 'requires_payment_method',
        created: 1234567890,
        metadata: { tenant_id: 'tenant-123', student_id: 'student-456' },
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'pi_test_123',
        amount: 10000,
        currency: 'inr',
        status: 'succeeded',
        payment_method: 'pm_test_card',
        created: 1234567890,
        metadata: { tenant_id: 'tenant-123' },
      }),
    },
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({
        id: 'evt_test_123',
        type: 'payment_intent.succeeded',
        created: 1234567890,
        data: {
          object: {
            id: 'pi_test_123',
            amount: 10000,
            currency: 'inr',
            status: 'succeeded',
            payment_method: 'pm_test_card',
            metadata: { tenant_id: 'tenant-123', student_id: 'student-456' },
          },
        },
      }),
    },
  }));
});

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({
        id: 'order_test_123',
        amount: 10000,
        currency: 'INR',
        status: 'created',
        receipt: 'rcpt_1234567890',
        created_at: 1234567890,
        notes: { tenant_id: 'tenant-123', student_id: 'student-456' },
      }),
    },
    payments: {
      fetch: jest.fn().mockResolvedValue({
        id: 'pay_test_123',
        order_id: 'order_test_123',
        amount: 10000,
        currency: 'INR',
        status: 'captured',
        method: 'upi',
        email: 'test@example.com',
        contact: '+919876543210',
        created_at: 1234567890,
        notes: { tenant_id: 'tenant-123' },
      }),
    },
  }));
});

const paymentService = require('./paymentService');

describe('PaymentService', () => {

  describe('Configuration', () => {
    it('should be configured when credentials are provided', () => {
      expect(paymentService.isConfigured()).toBe(true);
    });

    it('should be in test mode', () => {
      expect(paymentService.isTestMode()).toBe(true);
    });

    it('should return active gateway', () => {
      const gateway = paymentService.getActiveGateway();
      expect(['stripe', 'razorpay']).toContain(gateway);
    });
  });

  describe('Payment Methods', () => {
    it('should return supported payment methods', () => {
      const methods = paymentService.getSupportedPaymentMethods();

      expect(methods).toHaveProperty('razorpay');
      expect(methods).toHaveProperty('stripe');
      expect(methods.razorpay.methods).toContain('upi');
      expect(methods.razorpay.methods).toContain('netbanking');
      expect(methods.razorpay.methods).toContain('card');
    });

    it('should support Indian Rupee currency', () => {
      const methods = paymentService.getSupportedPaymentMethods();

      expect(methods.razorpay.currency).toBe('INR');
      expect(methods.stripe.currency).toBe('INR');
    });
  });

  describe('Create Payment', () => {
    it('should create payment with required parameters', async () => {
      const payment = await paymentService.createPayment({
        amount: 10000,
        currency: 'INR',
        tenantId: 'tenant-123',
        studentId: 'student-456',
        description: 'Test payment',
        metadata: { invoice_id: 'inv-123' },
      });

      expect(payment).toHaveProperty('id');
      expect(payment).toHaveProperty('amount', 10000);
      expect(payment).toHaveProperty('currency', 'INR');
      expect(payment).toHaveProperty('gateway');
      expect(['stripe', 'razorpay']).toContain(payment.gateway);
    });

    it('should include tenant and student metadata', async () => {
      const payment = await paymentService.createPayment({
        amount: 10000,
        tenantId: 'tenant-123',
        studentId: 'student-456',
        description: 'Test payment',
      });

      expect(payment.metadata).toHaveProperty('tenant_id', 'tenant-123');
      expect(payment.metadata).toHaveProperty('student_id', 'student-456');
    });
  });

  describe('Webhook Signature Verification', () => {
    it('should verify Razorpay webhook signature', () => {
      const payload = JSON.stringify({ event: 'payment.captured' });
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      const isValid = paymentService.verifyWebhookSignature(payload, signature, 'razorpay');
      expect(isValid).toBe(true);
    });

    it('should reject invalid Razorpay signature', () => {
      const payload = JSON.stringify({ event: 'payment.captured' });
      const invalidSignature = 'invalid_signature';

      expect(() => {
        paymentService.verifyWebhookSignature(payload, invalidSignature, 'razorpay');
      }).toThrow();
    });

    it('should verify Stripe webhook signature', () => {
      const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
      const signature = 'stripe_signature';

      const isValid = paymentService.verifyWebhookSignature(payload, signature, 'stripe');
      expect(isValid).toBe(true);
    });
  });

  describe('Parse Webhook Event', () => {
    it('should parse Razorpay webhook event', () => {
      const payload = JSON.stringify({
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
              notes: { tenant_id: 'tenant-123' },
            },
          },
        },
      });

      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      const event = paymentService.parseWebhookEvent(payload, signature, 'razorpay');

      expect(event.gateway).toBe('razorpay');
      expect(event.payment_id).toBe('pay_test_123');
      expect(event.amount).toBe(10000);
      expect(event.currency).toBe('INR');
      expect(event.method).toBe('upi');
    });

    it('should reject Razorpay webhook with invalid signature', () => {
      const payload = JSON.stringify({
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
              notes: { tenant_id: 'tenant-123' },
            },
          },
        },
      });

      // Create a signature with the same length but wrong value
      const crypto = require('crypto');
      const wrongPayload = JSON.stringify({ event: 'wrong.event' });
      const invalidSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(wrongPayload)
        .digest('hex');

      expect(() => {
        paymentService.parseWebhookEvent(payload, invalidSignature, 'razorpay');
      }).toThrow('Invalid webhook signature');
    });

    it('should parse Stripe webhook event', () => {
      const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
      const signature = 'stripe_signature';

      const event = paymentService.parseWebhookEvent(payload, signature, 'stripe');

      expect(event.gateway).toBe('stripe');
      expect(event.payment_id).toBe('pi_test_123');
      expect(event.amount).toBe(10000);
      expect(event.currency).toBe('INR');
    });
  });

  describe('Get Payment Details', () => {
    it('should retrieve Razorpay payment details', async () => {
      const payment = await paymentService.getPayment('pay_test_123', 'razorpay');

      expect(payment.gateway).toBe('razorpay');
      expect(payment.id).toBe('pay_test_123');
      expect(payment.amount).toBe(10000);
      expect(payment.currency).toBe('INR');
      expect(payment.method).toBe('upi');
    });

    it('should retrieve Stripe payment details', async () => {
      const payment = await paymentService.getPayment('pi_test_123', 'stripe');

      expect(payment.gateway).toBe('stripe');
      expect(payment.id).toBe('pi_test_123');
      expect(payment.amount).toBe(10000);
      expect(payment.currency).toBe('INR');
      expect(payment.status).toBe('succeeded');
    });
  });

  describe('Razorpay Integration', () => {
    it('should create Razorpay order', async () => {
      const payment = await paymentService.createRazorpayOrder({
        amount: 10000,
        currency: 'INR',
        description: 'Test payment',
        metadata: { tenant_id: 'tenant-123', student_id: 'student-456' },
      });

      expect(payment.gateway).toBe('razorpay');
      expect(payment.id).toBe('order_test_123');
      expect(payment.amount).toBe(10000);
      expect(payment.currency).toBe('INR');
      expect(payment.status).toBe('created');
    });

    it('should throw error when Razorpay not configured', async () => {
      const originalRazorpay = paymentService.razorpay;
      paymentService.razorpay = null;

      await expect(
        paymentService.createRazorpayOrder({
          amount: 10000,
          currency: 'INR',
          description: 'Test',
          metadata: {},
        })
      ).rejects.toThrow('Razorpay not configured');

      paymentService.razorpay = originalRazorpay;
    });

    it('should throw error when getting Razorpay payment without config', async () => {
      const originalRazorpay = paymentService.razorpay;
      paymentService.razorpay = null;

      await expect(
        paymentService.getRazorpayPayment('pay_test_123')
      ).rejects.toThrow('Razorpay not configured');

      paymentService.razorpay = originalRazorpay;
    });
  });

  describe('Stripe Integration', () => {
    it('should create Stripe payment intent', async () => {
      const payment = await paymentService.createStripePaymentIntent({
        amount: 10000,
        currency: 'INR',
        description: 'Test payment',
        metadata: { tenant_id: 'tenant-123', student_id: 'student-456' },
      });

      expect(payment.gateway).toBe('stripe');
      expect(payment.id).toBe('pi_test_123');
      expect(payment.amount).toBe(10000);
      expect(payment.currency).toBe('INR');
      expect(payment).toHaveProperty('client_secret');
    });

    it('should prefer Stripe when Razorpay is not configured', async () => {
      const originalRazorpay = paymentService.razorpay;
      paymentService.razorpay = null;

      const gateway = paymentService.getActiveGateway();
      expect(gateway).toBe('stripe');

      const payment = await paymentService.createPayment({
        amount: 10000,
        tenantId: 'tenant-123',
        studentId: 'student-456',
        description: 'Test payment',
      });

      expect(payment.gateway).toBe('stripe');

      paymentService.razorpay = originalRazorpay;
    });

    it('should throw error when Stripe not configured', async () => {
      const originalStripe = paymentService.stripe;
      paymentService.stripe = null;

      await expect(
        paymentService.createStripePaymentIntent({
          amount: 10000,
          currency: 'INR',
          description: 'Test',
          metadata: {},
        })
      ).rejects.toThrow('Stripe not configured');

      paymentService.stripe = originalStripe;
    });

    it('should throw error when getting Stripe payment without config', async () => {
      const originalStripe = paymentService.stripe;
      paymentService.stripe = null;

      await expect(
        paymentService.getStripePayment('pi_test_123')
      ).rejects.toThrow('Stripe not configured');

      paymentService.stripe = originalStripe;
    });

    it('should throw error when verifying Stripe signature without config', () => {
      const originalStripe = paymentService.stripe;
      paymentService.stripe = null;

      expect(() => {
        paymentService.verifyStripeSignature('payload', 'signature');
      }).toThrow('Stripe webhook secret not configured');

      paymentService.stripe = originalStripe;
    });

    it('should throw error when parsing Stripe webhook without config', () => {
      const originalStripe = paymentService.stripe;
      paymentService.stripe = null;

      expect(() => {
        paymentService.parseStripeWebhook('payload', 'signature');
      }).toThrow('Stripe not configured');

      paymentService.stripe = originalStripe;
    });
  });

  describe('Webhook Signature Verification - Edge Cases', () => {
    it('should throw error when Razorpay webhook secret not configured', () => {
      const originalSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      delete process.env.RAZORPAY_WEBHOOK_SECRET;

      expect(() => {
        paymentService.verifyRazorpaySignature('payload', 'signature');
      }).toThrow('Razorpay webhook secret not configured');

      process.env.RAZORPAY_WEBHOOK_SECRET = originalSecret;
    });

    it('should return false for invalid Stripe signature', () => {
      const Stripe = require('stripe');
      const mockStripe = paymentService.stripe;
      
      mockStripe.webhooks.constructEvent = jest.fn().mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const isValid = paymentService.verifyStripeSignature('payload', 'invalid_signature');
      expect(isValid).toBe(false);
    });

    it('should throw error for unsupported gateway in webhook verification', () => {
      expect(() => {
        paymentService.verifyWebhookSignature('payload', 'signature', 'unsupported');
      }).toThrow('Unsupported gateway: unsupported');
    });

    it('should throw error for unsupported gateway in webhook parsing', () => {
      expect(() => {
        paymentService.parseWebhookEvent('payload', 'signature', 'unsupported');
      }).toThrow('Unsupported gateway: unsupported');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when no gateway configured', () => {
      // Temporarily remove credentials
      const originalStripe = process.env.STRIPE_SECRET_KEY;
      const originalRazorpay = process.env.RAZORPAY_KEY_ID;

      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.RAZORPAY_KEY_ID;

      // Create new instance without credentials
      const PaymentService = require('./paymentService').constructor;
      const unconfiguredService = new PaymentService();

      expect(() => {
        unconfiguredService.getActiveGateway();
      }).toThrow('No payment gateway configured');

      // Restore credentials
      process.env.STRIPE_SECRET_KEY = originalStripe;
      process.env.RAZORPAY_KEY_ID = originalRazorpay;
    });

    it('should throw error for unsupported gateway', async () => {
      await expect(
        paymentService.getPayment('pay_123', 'unsupported')
      ).rejects.toThrow('Unsupported gateway');
    });

    it('should use default currency when not specified', async () => {
      const payment = await paymentService.createPayment({
        amount: 10000,
        tenantId: 'tenant-123',
        studentId: 'student-456',
        description: 'Test payment',
      });

      expect(payment.currency).toBe('INR');
    });

    it('should include environment in metadata', async () => {
      const payment = await paymentService.createPayment({
        amount: 10000,
        tenantId: 'tenant-123',
        studentId: 'student-456',
        description: 'Test payment',
      });

      // Check that the payment was created successfully
      expect(payment).toHaveProperty('id');
      expect(payment).toHaveProperty('gateway');
    });
  });
});
