/**
 * Refunds Routes Tests
 * 
 * Tests for refund request creation, approval chain, and processing
 */

const request = require('supertest');
const express = require('express');
const refundsRouter = require('./refunds');
const paymentService = require('../services/paymentService');

// Mock payment service
jest.mock('../services/paymentService');

// Create Express app for testing
const app = express();
app.use(express.json());

// Mock middleware
app.use((req, res, next) => {
  req.tenantId = 'test-tenant-id';
  req.db = {
    query: jest.fn(),
    connect: jest.fn(),
  };
  next();
});

app.use('/api/v1/refunds', refundsRouter);

describe('Refunds Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/refunds', () => {
    it('should create a refund request successfully', async () => {
      const mockRefundRequest = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        tenant_id: 'test-tenant-id',
        payment_id: '550e8400-e29b-41d4-a716-446655440001',
        invoice_id: null,
        refund_amount: 50000,
        currency: 'INR',
        refund_type: 'partial',
        reason: 'Customer requested partial refund',
        supporting_documents: ['doc1.pdf'],
        status: 'pending',
        requested_by: '550e8400-e29b-41d4-a716-446655440002',
        created_at: new Date().toISOString(),
      };

      paymentService.createRefundRequest.mockResolvedValue(mockRefundRequest);

      const response = await request(app)
        .post('/api/v1/refunds')
        .send({
          payment_id: '550e8400-e29b-41d4-a716-446655440001',
          refund_amount: 50000,
          refund_type: 'partial',
          reason: 'Customer requested partial refund',
          supporting_documents: ['doc1.pdf'],
          requested_by: '550e8400-e29b-41d4-a716-446655440002',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRefundRequest);
      expect(paymentService.createRefundRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'test-tenant-id',
          paymentId: '550e8400-e29b-41d4-a716-446655440001',
          refundAmount: 50000,
          refundType: 'partial',
          reason: 'Customer requested partial refund',
        }),
        expect.any(Object)
      );
    });

    it('should create a refund request with invoice_id', async () => {
      const mockRefundRequest = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        tenant_id: 'test-tenant-id',
        payment_id: null,
        invoice_id: '550e8400-e29b-41d4-a716-446655440007',
        refund_amount: 100000,
        currency: 'INR',
        refund_type: 'full',
        reason: 'Invoice cancelled',
        supporting_documents: [],
        status: 'pending',
        requested_by: '550e8400-e29b-41d4-a716-446655440002',
        created_at: new Date().toISOString(),
      };

      paymentService.createRefundRequest.mockResolvedValue(mockRefundRequest);

      const response = await request(app)
        .post('/api/v1/refunds')
        .send({
          invoice_id: '550e8400-e29b-41d4-a716-446655440007',
          refund_amount: 100000,
          refund_type: 'full',
          reason: 'Invoice cancelled',
          requested_by: '550e8400-e29b-41d4-a716-446655440002',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.invoice_id).toBe('550e8400-e29b-41d4-a716-446655440007');
    });

    it('should require either payment_id or invoice_id', async () => {
      const response = await request(app)
        .post('/api/v1/refunds')
        .send({
          refund_amount: 50000,
          refund_type: 'full',
          reason: 'Test reason',
          requested_by: '550e8400-e29b-41d4-a716-446655440002',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('payment_id or invoice_id');
    });

    it('should validate refund_type', async () => {
      const response = await request(app)
        .post('/api/v1/refunds')
        .send({
          payment_id: '550e8400-e29b-41d4-a716-446655440001',
          refund_amount: 50000,
          refund_type: 'invalid',
          reason: 'Test reason',
          requested_by: '550e8400-e29b-41d4-a716-446655440002',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate refund_amount is positive', async () => {
      const response = await request(app)
        .post('/api/v1/refunds')
        .send({
          payment_id: '550e8400-e29b-41d4-a716-446655440001',
          refund_amount: -100,
          refund_type: 'full',
          reason: 'Test reason',
          requested_by: '550e8400-e29b-41d4-a716-446655440002',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate payment_id is UUID', async () => {
      const response = await request(app)
        .post('/api/v1/refunds')
        .send({
          payment_id: 'invalid-uuid',
          refund_amount: 50000,
          refund_type: 'full',
          reason: 'Test reason',
          requested_by: '550e8400-e29b-41d4-a716-446655440002',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate invoice_id is UUID', async () => {
      const response = await request(app)
        .post('/api/v1/refunds')
        .send({
          invoice_id: 'invalid-uuid',
          refund_amount: 50000,
          refund_type: 'full',
          reason: 'Test reason',
          requested_by: '550e8400-e29b-41d4-a716-446655440002',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate requested_by is UUID', async () => {
      const response = await request(app)
        .post('/api/v1/refunds')
        .send({
          payment_id: '550e8400-e29b-41d4-a716-446655440001',
          refund_amount: 50000,
          refund_type: 'full',
          reason: 'Test reason',
          requested_by: 'invalid-uuid',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate reason is required', async () => {
      const response = await request(app)
        .post('/api/v1/refunds')
        .send({
          payment_id: '550e8400-e29b-41d4-a716-446655440001',
          refund_amount: 50000,
          refund_type: 'full',
          requested_by: '550e8400-e29b-41d4-a716-446655440002',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate supporting_documents is array', async () => {
      const response = await request(app)
        .post('/api/v1/refunds')
        .send({
          payment_id: '550e8400-e29b-41d4-a716-446655440001',
          refund_amount: 50000,
          refund_type: 'full',
          reason: 'Test reason',
          requested_by: '550e8400-e29b-41d4-a716-446655440002',
          supporting_documents: 'not-an-array',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle service errors', async () => {
      paymentService.createRefundRequest.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/v1/refunds')
        .send({
          payment_id: '550e8400-e29b-41d4-a716-446655440001',
          refund_amount: 50000,
          refund_type: 'full',
          reason: 'Test reason',
          requested_by: '550e8400-e29b-41d4-a716-446655440002',
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to create refund request');
    });
  });

  describe('GET /api/v1/refunds/:id', () => {
    it('should get refund request by ID', async () => {
      const mockRefundRequest = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        tenant_id: 'test-tenant-id',
        payment_id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'pending',
      };

      paymentService.getRefundRequest.mockResolvedValue(mockRefundRequest);

      const response = await request(app)
        .get('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRefundRequest);
    });

    it('should return 404 if refund request not found', async () => {
      paymentService.getRefundRequest.mockRejectedValue(new Error('Refund request not found'));

      const response = await request(app)
        .get('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should validate ID is UUID', async () => {
      const response = await request(app)
        .get('/api/v1/refunds/invalid-uuid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle service errors', async () => {
      paymentService.getRefundRequest.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve refund request');
    });
  });

  describe('GET /api/v1/refunds', () => {
    it('should list refund requests', async () => {
      const mockRefundRequests = [
        { id: 'refund-1', status: 'pending' },
        { id: 'refund-2', status: 'approved' },
      ];

      paymentService.listRefundRequests.mockResolvedValue(mockRefundRequests);

      const response = await request(app)
        .get('/api/v1/refunds');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRefundRequests);
      expect(response.body.count).toBe(2);
    });

    it('should filter by status', async () => {
      const mockRefundRequests = [
        { id: 'refund-1', status: 'approved' },
      ];

      paymentService.listRefundRequests.mockResolvedValue(mockRefundRequests);

      const response = await request(app)
        .get('/api/v1/refunds?status=approved');

      expect(response.status).toBe(200);
      expect(paymentService.listRefundRequests).toHaveBeenCalledWith(
        'test-tenant-id',
        expect.any(Object),
        expect.objectContaining({ status: 'approved' })
      );
    });

    it('should filter by payment_id', async () => {
      const mockRefundRequests = [
        { id: 'refund-1', payment_id: '550e8400-e29b-41d4-a716-446655440001' },
      ];

      paymentService.listRefundRequests.mockResolvedValue(mockRefundRequests);

      const response = await request(app)
        .get('/api/v1/refunds?payment_id=550e8400-e29b-41d4-a716-446655440001');

      expect(response.status).toBe(200);
      expect(paymentService.listRefundRequests).toHaveBeenCalledWith(
        'test-tenant-id',
        expect.any(Object),
        expect.objectContaining({ paymentId: '550e8400-e29b-41d4-a716-446655440001' })
      );
    });

    it('should filter by invoice_id', async () => {
      const mockRefundRequests = [
        { id: 'refund-1', invoice_id: '550e8400-e29b-41d4-a716-446655440007' },
      ];

      paymentService.listRefundRequests.mockResolvedValue(mockRefundRequests);

      const response = await request(app)
        .get('/api/v1/refunds?invoice_id=550e8400-e29b-41d4-a716-446655440007');

      expect(response.status).toBe(200);
      expect(paymentService.listRefundRequests).toHaveBeenCalledWith(
        'test-tenant-id',
        expect.any(Object),
        expect.objectContaining({ invoiceId: '550e8400-e29b-41d4-a716-446655440007' })
      );
    });

    it('should apply limit and offset', async () => {
      const mockRefundRequests = [
        { id: 'refund-1', status: 'pending' },
      ];

      paymentService.listRefundRequests.mockResolvedValue(mockRefundRequests);

      const response = await request(app)
        .get('/api/v1/refunds?limit=10&offset=5');

      expect(response.status).toBe(200);
      expect(paymentService.listRefundRequests).toHaveBeenCalledWith(
        'test-tenant-id',
        expect.any(Object),
        expect.objectContaining({ limit: 10, offset: 5 })
      );
    });

    it('should validate limit is within range', async () => {
      const response = await request(app)
        .get('/api/v1/refunds?limit=200');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate offset is non-negative', async () => {
      const response = await request(app)
        .get('/api/v1/refunds?offset=-5');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate status value', async () => {
      const response = await request(app)
        .get('/api/v1/refunds?status=invalid_status');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate payment_id is UUID', async () => {
      const response = await request(app)
        .get('/api/v1/refunds?payment_id=invalid-uuid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate invoice_id is UUID', async () => {
      const response = await request(app)
        .get('/api/v1/refunds?invoice_id=invalid-uuid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle service errors', async () => {
      paymentService.listRefundRequests.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/refunds');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to list refund requests');
    });
  });

  describe('POST /api/v1/refunds/:id/approve', () => {
    it('should approve refund request as teacher', async () => {
      const mockRefundRequest = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'pending',
        teacher_approved_by: '550e8400-e29b-41d4-a716-446655440003',
        teacher_approved_at: new Date().toISOString(),
      };

      paymentService.approveRefundRequest.mockResolvedValue(mockRefundRequest);

      const response = await request(app)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/approve')
        .send({
          approver_role: 'teacher',
          approver_id: '550e8400-e29b-41d4-a716-446655440003',
          comments: 'Approved by teacher',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.teacher_approved_by).toBe('550e8400-e29b-41d4-a716-446655440003');
      expect(response.body.message).toContain('teacher');
    });

    it('should approve refund request as admin', async () => {
      const mockRefundRequest = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'pending',
        teacher_approved_by: '550e8400-e29b-41d4-a716-446655440003',
        admin_approved_by: '550e8400-e29b-41d4-a716-446655440004',
        admin_approved_at: new Date().toISOString(),
      };

      paymentService.approveRefundRequest.mockResolvedValue(mockRefundRequest);

      const response = await request(app)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/approve')
        .send({
          approver_role: 'admin',
          approver_id: '550e8400-e29b-41d4-a716-446655440004',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.admin_approved_by).toBe('550e8400-e29b-41d4-a716-446655440004');
    });

    it('should approve refund request as finance_manager and change status to approved', async () => {
      const mockRefundRequest = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'approved',
        teacher_approved_by: '550e8400-e29b-41d4-a716-446655440003',
        admin_approved_by: '550e8400-e29b-41d4-a716-446655440004',
        finance_approved_by: '550e8400-e29b-41d4-a716-446655440005',
        finance_approved_at: new Date().toISOString(),
      };

      paymentService.approveRefundRequest.mockResolvedValue(mockRefundRequest);

      const response = await request(app)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/approve')
        .send({
          approver_role: 'finance_manager',
          approver_id: '550e8400-e29b-41d4-a716-446655440005',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('approved');
      expect(response.body.data.finance_approved_by).toBe('550e8400-e29b-41d4-a716-446655440005');
    });

    it('should validate approver_role', async () => {
      const response = await request(app)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/approve')
        .send({
          approver_role: 'invalid_role',
          approver_id: '550e8400-e29b-41d4-a716-446655440003',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate approver_id is UUID', async () => {
      const response = await request(app)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/approve')
        .send({
          approver_role: 'teacher',
          approver_id: 'invalid-uuid',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate refund ID is UUID', async () => {
      const response = await request(app)
        .post('/api/v1/refunds/invalid-uuid/approve')
        .send({
          approver_role: 'teacher',
          approver_id: '550e8400-e29b-41d4-a716-446655440003',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle approval chain validation errors', async () => {
      paymentService.approveRefundRequest.mockRejectedValue(
        new Error('Teacher approval required first')
      );

      const response = await request(app)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/approve')
        .send({
          approver_role: 'admin',
          approver_id: '550e8400-e29b-41d4-a716-446655440004',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required first');
    });

    it('should handle not found errors', async () => {
      paymentService.approveRefundRequest.mockRejectedValue(
        new Error('Refund request not found')
      );

      const response = await request(app)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/approve')
        .send({
          approver_role: 'teacher',
          approver_id: '550e8400-e29b-41d4-a716-446655440003',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle service errors', async () => {
      paymentService.approveRefundRequest.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/approve')
        .send({
          approver_role: 'teacher',
          approver_id: '550e8400-e29b-41d4-a716-446655440003',
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to approve refund request');
    });
  });

  describe('POST /api/v1/refunds/:id/reject', () => {
    it('should reject refund request', async () => {
      const mockRefundRequest = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'rejected',
        teacher_approved_by: '550e8400-e29b-41d4-a716-446655440003',
        teacher_rejection_reason: 'Insufficient documentation',
      };

      paymentService.rejectRefundRequest.mockResolvedValue(mockRefundRequest);

      const response = await request(app)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/reject')
        .send({
          approver_role: 'teacher',
          approver_id: '550e8400-e29b-41d4-a716-446655440003',
          rejection_reason: 'Insufficient documentation',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('rejected');
      expect(response.body.data.teacher_rejection_reason).toBe('Insufficient documentation');
    });

    it('should require rejection_reason', async () => {
      const response = await request(app)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/reject')
        .send({
          approver_role: 'teacher',
          approver_id: '550e8400-e29b-41d4-a716-446655440003',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate approver_role', async () => {
      const response = await request(app)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/reject')
        .send({
          approver_role: 'invalid_role',
          approver_id: '550e8400-e29b-41d4-a716-446655440003',
          rejection_reason: 'Test reason',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate approver_id is UUID', async () => {
      const response = await request(app)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/reject')
        .send({
          approver_role: 'teacher',
          approver_id: 'invalid-uuid',
          rejection_reason: 'Test reason',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate refund ID is UUID', async () => {
      const response = await request(app)
        .post('/api/v1/refunds/invalid-uuid/reject')
        .send({
          approver_role: 'teacher',
          approver_id: '550e8400-e29b-41d4-a716-446655440003',
          rejection_reason: 'Test reason',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle not found errors', async () => {
      paymentService.rejectRefundRequest.mockRejectedValue(
        new Error('Refund request not found')
      );

      const response = await request(app)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/reject')
        .send({
          approver_role: 'teacher',
          approver_id: '550e8400-e29b-41d4-a716-446655440003',
          rejection_reason: 'Test reason',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should handle service errors', async () => {
      paymentService.rejectRefundRequest.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/reject')
        .send({
          approver_role: 'teacher',
          approver_id: '550e8400-e29b-41d4-a716-446655440003',
          rejection_reason: 'Test reason',
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to reject refund request');
    });
  });

  describe('POST /api/v1/refunds/:id/process', () => {
    it('should process approved refund', async () => {
      const mockRefundRequest = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'processed',
        processed_by: '550e8400-e29b-41d4-a716-446655440005',
        processed_at: new Date().toISOString(),
        gateway_refund_id: 'rfnd_123',
        gateway_status: 'succeeded',
      };

      paymentService.processRefund.mockResolvedValue(mockRefundRequest);

      const response = await request(app)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/process')
        .send({
          processed_by: '550e8400-e29b-41d4-a716-446655440005',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('processed');
      expect(response.body.data.gateway_refund_id).toBe('rfnd_123');
    });

    it('should validate processed_by is UUID', async () => {
      const response = await request(app)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/process')
        .send({
          processed_by: 'invalid-uuid',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate refund ID is UUID', async () => {
      const response = await request(app)
        .post('/api/v1/refunds/invalid-uuid/process')
        .send({
          processed_by: '550e8400-e29b-41d4-a716-446655440005',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle processing errors', async () => {
      paymentService.processRefund.mockRejectedValue(
        new Error('Refund request must be approved before processing')
      );

      const response = await request(app)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/process')
        .send({
          processed_by: '550e8400-e29b-41d4-a716-446655440005',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be approved');
    });

    it('should handle not found errors', async () => {
      paymentService.processRefund.mockRejectedValue(
        new Error('Refund request not found')
      );

      const response = await request(app)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/process')
        .send({
          processed_by: '550e8400-e29b-41d4-a716-446655440005',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle service errors', async () => {
      paymentService.processRefund.mockRejectedValue(new Error('Gateway error'));

      const response = await request(app)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/process')
        .send({
          processed_by: '550e8400-e29b-41d4-a716-446655440005',
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to process refund');
    });
  });

  describe('GET /api/v1/refunds/:id/history', () => {
    it('should get refund approval history', async () => {
      const mockHistory = [
        {
          id: '550e8400-e29b-41d4-a716-446655440010',
          approver_role: 'teacher',
          approver_id: '550e8400-e29b-41d4-a716-446655440003',
          action: 'approved',
          comments: 'Looks good',
          created_at: new Date().toISOString(),
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440011',
          approver_role: 'admin',
          approver_id: '550e8400-e29b-41d4-a716-446655440004',
          action: 'approved',
          comments: null,
          created_at: new Date().toISOString(),
        },
      ];

      paymentService.getRefundApprovalHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/history');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockHistory);
      expect(response.body.data).toHaveLength(2);
    });

    it('should validate refund ID is UUID', async () => {
      const response = await request(app)
        .get('/api/v1/refunds/invalid-uuid/history');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle service errors', async () => {
      paymentService.getRefundApprovalHistory.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/history');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve refund approval history');
    });
  });

  // Test missing tenant ID for all routes
  describe('Tenant ID validation', () => {
    let appWithoutTenant;

    beforeEach(() => {
      appWithoutTenant = express();
      appWithoutTenant.use(express.json());
      appWithoutTenant.use((req, res, next) => {
        req.db = { query: jest.fn() };
        next();
      });
      appWithoutTenant.use('/api/v1/refunds', refundsRouter);
    });

    it('should require tenant ID for POST /api/v1/refunds', async () => {
      const response = await request(appWithoutTenant)
        .post('/api/v1/refunds')
        .send({
          payment_id: '550e8400-e29b-41d4-a716-446655440001',
          refund_amount: 50000,
          refund_type: 'full',
          reason: 'Test reason',
          requested_by: '550e8400-e29b-41d4-a716-446655440002',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Tenant ID is required');
    });

    it('should require tenant ID for GET /api/v1/refunds/:id', async () => {
      const response = await request(appWithoutTenant)
        .get('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Tenant ID is required');
    });

    it('should require tenant ID for GET /api/v1/refunds', async () => {
      const response = await request(appWithoutTenant)
        .get('/api/v1/refunds');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Tenant ID is required');
    });

    it('should require tenant ID for POST /api/v1/refunds/:id/approve', async () => {
      const response = await request(appWithoutTenant)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/approve')
        .send({
          approver_role: 'teacher',
          approver_id: '550e8400-e29b-41d4-a716-446655440003',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Tenant ID is required');
    });

    it('should require tenant ID for POST /api/v1/refunds/:id/reject', async () => {
      const response = await request(appWithoutTenant)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/reject')
        .send({
          approver_role: 'teacher',
          approver_id: '550e8400-e29b-41d4-a716-446655440003',
          rejection_reason: 'Test reason',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Tenant ID is required');
    });

    it('should require tenant ID for POST /api/v1/refunds/:id/process', async () => {
      const response = await request(appWithoutTenant)
        .post('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/process')
        .send({
          processed_by: '550e8400-e29b-41d4-a716-446655440005',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Tenant ID is required');
    });

    it('should require tenant ID for GET /api/v1/refunds/:id/history', async () => {
      const response = await request(appWithoutTenant)
        .get('/api/v1/refunds/550e8400-e29b-41d4-a716-446655440000/history');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Tenant ID is required');
    });
  });
});
