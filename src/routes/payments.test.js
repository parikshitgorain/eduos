/**
 * Payment Routes Tests
 */

const request = require('supertest');
const express = require('express');
const paymentRoutes = require('./payments');

// Mock payment service
jest.mock('../services/paymentService', () => ({
  createPayment: jest.fn(),
  getPayment: jest.fn(),
  getSupportedPaymentMethods: jest.fn(),
  isTestMode: jest.fn(),
  isConfigured: jest.fn(),
  getActiveGateway: jest.fn(),
}));

const paymentService = require('../services/paymentService');

// Create test app
const app = express();
app.use(express.json());

// Mock tenant context middleware
app.use((req, res, next) => {
  req.tenantId = 'test-tenant-123';
  next();
});

app.use('/api/v1/payments', paymentRoutes);

describe('Payment Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/payments', () => {
    it('should create payment with valid data', async () => {
      const mockPayment = {
        gateway: 'razorpay',
        id: 'order_test_123',
        amount: 10000,
        currency: 'INR',
        status: 'created',
      };

      paymentService.createPayment.mockResolvedValue(mockPayment);

      const response = await request(app)
        .post('/api/v1/payments')
        .send({
          amount: 10000,
          currency: 'INR',
          student_id: '123e4567-e89b-12d3-a456-426614174000',
          description: 'Tuition fee payment',
          metadata: { invoice_id: 'inv-123' },
        });

      if (response.status !== 201) {
        console.log('Response body:', response.body);
      }

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPayment);
      expect(paymentService.createPayment).toHaveBeenCalledWith({
        amount: 10000,
        currency: 'INR',
        tenantId: 'test-tenant-123',
        studentId: '123e4567-e89b-12d3-a456-426614174000',
        description: 'Tuition fee payment',
        metadata: { invoice_id: 'inv-123' },
      });
    });

    it('should reject invalid amount', async () => {
      const response = await request(app)
        .post('/api/v1/payments')
        .send({
          amount: -100,
          student_id: 'student-456',
          description: 'Test payment',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should reject missing student_id', async () => {
      const response = await request(app)
        .post('/api/v1/payments')
        .send({
          amount: 10000,
          description: 'Test payment',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid student_id format', async () => {
      const response = await request(app)
        .post('/api/v1/payments')
        .send({
          amount: 10000,
          student_id: 'invalid-uuid',
          description: 'Test payment',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle payment service errors', async () => {
      paymentService.createPayment.mockRejectedValue(new Error('Payment gateway error'));

      const response = await request(app)
        .post('/api/v1/payments')
        .send({
          amount: 10000,
          student_id: '123e4567-e89b-12d3-a456-426614174000',
          description: 'Test payment',
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to create payment');
    });
  });

  describe('GET /api/v1/payments/:gateway/:paymentId', () => {
    it('should retrieve payment details', async () => {
      const mockPayment = {
        gateway: 'razorpay',
        id: 'pay_test_123',
        amount: 10000,
        currency: 'INR',
        status: 'captured',
        method: 'upi',
      };

      paymentService.getPayment.mockResolvedValue(mockPayment);

      const response = await request(app)
        .get('/api/v1/payments/razorpay/pay_test_123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPayment);
      expect(paymentService.getPayment).toHaveBeenCalledWith('pay_test_123', 'razorpay');
    });

    it('should reject invalid gateway', async () => {
      const response = await request(app)
        .get('/api/v1/payments/invalid/pay_test_123');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle payment not found', async () => {
      paymentService.getPayment.mockRejectedValue(new Error('Payment not found'));

      const response = await request(app)
        .get('/api/v1/payments/razorpay/pay_nonexistent');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/payments/methods', () => {
    it('should return supported payment methods', async () => {
      const mockMethods = {
        razorpay: {
          available: true,
          methods: ['card', 'upi', 'netbanking', 'wallet'],
          currency: 'INR',
        },
        stripe: {
          available: true,
          methods: ['card'],
          currency: 'INR',
        },
      };

      paymentService.getSupportedPaymentMethods.mockReturnValue(mockMethods);

      const response = await request(app)
        .get('/api/v1/payments/methods');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockMethods);
    });
  });

  describe('GET /api/v1/payments/health', () => {
    it('should return health status', async () => {
      paymentService.isTestMode.mockReturnValue(true);
      paymentService.isConfigured.mockReturnValue(true);
      paymentService.getActiveGateway.mockReturnValue('razorpay');

      const response = await request(app)
        .get('/api/v1/payments/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.test_mode).toBe(true);
      expect(response.body.configured).toBe(true);
      expect(response.body.active_gateway).toBe('razorpay');
    });
  });
});
