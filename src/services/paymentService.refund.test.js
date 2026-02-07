/**
 * Payment Service Refund Tests
 * 
 * Tests for refund workflow functionality
 */

const paymentService = require('./paymentService');

describe('PaymentService - Refund Workflow', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      connect: jest.fn(() => Promise.resolve({
        query: jest.fn(),
        release: jest.fn(),
      })),
    };
  });

  describe('createRefundRequest', () => {
    it('should create a refund request successfully', async () => {
      const mockRefundRequest = {
        id: 'refund-123',
        tenant_id: 'tenant-123',
        payment_id: 'payment-123',
        invoice_id: null,
        refund_amount: 50000,
        currency: 'INR',
        refund_type: 'partial',
        reason: 'Customer requested partial refund',
        supporting_documents: JSON.stringify(['doc1.pdf']),
        requested_by: 'user-123',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockRefundRequest] });

      const result = await paymentService.createRefundRequest({
        tenantId: 'tenant-123',
        paymentId: 'payment-123',
        refundAmount: 50000,
        refundType: 'partial',
        reason: 'Customer requested partial refund',
        supportingDocuments: ['doc1.pdf'],
        requestedBy: 'user-123',
      }, mockDb);

      expect(result.id).toBe('refund-123');
      expect(result.refund_amount).toBe(50000);
      expect(result.status).toBe('pending');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO refund_requests'),
        expect.arrayContaining(['tenant-123', 'payment-123', 50000])
      );
    });

    it('should throw error if neither payment_id nor invoice_id provided', async () => {
      await expect(
        paymentService.createRefundRequest({
          tenantId: 'tenant-123',
          refundAmount: 50000,
          refundType: 'full',
          reason: 'Test',
          requestedBy: 'user-123',
        }, mockDb)
      ).rejects.toThrow('Either payment_id or invoice_id must be provided');
    });

    it('should throw error for invalid refund type', async () => {
      await expect(
        paymentService.createRefundRequest({
          tenantId: 'tenant-123',
          paymentId: 'payment-123',
          refundAmount: 50000,
          refundType: 'invalid',
          reason: 'Test',
          requestedBy: 'user-123',
        }, mockDb)
      ).rejects.toThrow('Refund type must be either "full" or "partial"');
    });
  });

  describe('getRefundRequest', () => {
    it('should get refund request by ID', async () => {
      const mockRefundRequest = {
        id: 'refund-123',
        tenant_id: 'tenant-123',
        status: 'pending',
      };

      mockDb.query.mockResolvedValue({ rows: [mockRefundRequest] });

      const result = await paymentService.getRefundRequest('refund-123', 'tenant-123', mockDb);

      expect(result.id).toBe('refund-123');
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM refund_requests WHERE id = $1 AND tenant_id = $2',
        ['refund-123', 'tenant-123']
      );
    });

    it('should throw error if refund request not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await expect(
        paymentService.getRefundRequest('nonexistent', 'tenant-123', mockDb)
      ).rejects.toThrow('Refund request not found');
    });
  });

  describe('listRefundRequests', () => {
    it('should list refund requests', async () => {
      const mockRefundRequests = [
        { id: 'refund-1', status: 'pending' },
        { id: 'refund-2', status: 'approved' },
      ];

      mockDb.query.mockResolvedValue({ rows: mockRefundRequests });

      const result = await paymentService.listRefundRequests('tenant-123', mockDb);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('refund-1');
    });

    it('should filter by status', async () => {
      const mockRefundRequests = [
        { id: 'refund-1', status: 'approved' },
      ];

      mockDb.query.mockResolvedValue({ rows: mockRefundRequests });

      const result = await paymentService.listRefundRequests('tenant-123', mockDb, {
        status: 'approved',
      });

      expect(result).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $2'),
        expect.arrayContaining(['tenant-123', 'approved'])
      );
    });
  });

  describe('approveRefundRequest', () => {
    it('should approve refund request as teacher', async () => {
      const mockRefund = {
        id: 'refund-123',
        tenant_id: 'tenant-123',
        status: 'pending',
        teacher_approved_by: null,
        admin_approved_by: null,
        finance_approved_by: null,
      };

      const mockUpdatedRefund = {
        ...mockRefund,
        teacher_approved_by: 'teacher-123',
        teacher_approved_at: new Date(),
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockRefund] }) // SELECT
          .mockResolvedValueOnce({ rows: [mockUpdatedRefund] }) // UPDATE
          .mockResolvedValueOnce({ rows: [] }) // INSERT history
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      const result = await paymentService.approveRefundRequest(
        'refund-123',
        'tenant-123',
        'teacher',
        'teacher-123',
        'Looks good',
        mockDb
      );

      expect(result.teacher_approved_by).toBe('teacher-123');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should approve refund request as admin after teacher approval', async () => {
      const mockRefund = {
        id: 'refund-123',
        tenant_id: 'tenant-123',
        status: 'pending',
        teacher_approved_by: 'teacher-123',
        admin_approved_by: null,
        finance_approved_by: null,
      };

      const mockUpdatedRefund = {
        ...mockRefund,
        admin_approved_by: 'admin-123',
        admin_approved_at: new Date(),
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockRefund] }) // SELECT
          .mockResolvedValueOnce({ rows: [mockUpdatedRefund] }) // UPDATE
          .mockResolvedValueOnce({ rows: [] }) // INSERT history
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      const result = await paymentService.approveRefundRequest(
        'refund-123',
        'tenant-123',
        'admin',
        'admin-123',
        null,
        mockDb
      );

      expect(result.admin_approved_by).toBe('admin-123');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should approve refund request as finance_manager and change status to approved', async () => {
      const mockRefund = {
        id: 'refund-123',
        tenant_id: 'tenant-123',
        status: 'pending',
        teacher_approved_by: 'teacher-123',
        admin_approved_by: 'admin-123',
        finance_approved_by: null,
      };

      const mockUpdatedRefund = {
        ...mockRefund,
        finance_approved_by: 'finance-123',
        finance_approved_at: new Date(),
        status: 'approved',
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockRefund] }) // SELECT
          .mockResolvedValueOnce({ rows: [mockUpdatedRefund] }) // UPDATE
          .mockResolvedValueOnce({ rows: [] }) // INSERT history
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      const result = await paymentService.approveRefundRequest(
        'refund-123',
        'tenant-123',
        'finance_manager',
        'finance-123',
        null,
        mockDb
      );

      expect(result.status).toBe('approved');
      expect(result.finance_approved_by).toBe('finance-123');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if admin tries to approve without teacher approval', async () => {
      const mockRefund = {
        id: 'refund-123',
        tenant_id: 'tenant-123',
        status: 'pending',
        teacher_approved_by: null,
        admin_approved_by: null,
        finance_approved_by: null,
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockRefund] }) // SELECT
          .mockResolvedValueOnce(undefined), // ROLLBACK
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      await expect(
        paymentService.approveRefundRequest(
          'refund-123',
          'tenant-123',
          'admin',
          'admin-123',
          null,
          mockDb
        )
      ).rejects.toThrow('Teacher approval required first');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if finance_manager tries to approve without teacher and admin approval', async () => {
      const mockRefund = {
        id: 'refund-123',
        tenant_id: 'tenant-123',
        status: 'pending',
        teacher_approved_by: 'teacher-123',
        admin_approved_by: null,
        finance_approved_by: null,
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockRefund] }) // SELECT
          .mockResolvedValueOnce(undefined), // ROLLBACK
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      await expect(
        paymentService.approveRefundRequest(
          'refund-123',
          'tenant-123',
          'finance_manager',
          'finance-123',
          null,
          mockDb
        )
      ).rejects.toThrow('Teacher and Admin approval required first');

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if refund already approved or rejected', async () => {
      const mockRefund = {
        id: 'refund-123',
        tenant_id: 'tenant-123',
        status: 'approved',
        teacher_approved_by: 'teacher-123',
        admin_approved_by: 'admin-123',
        finance_approved_by: 'finance-123',
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockRefund] }) // SELECT
          .mockResolvedValueOnce(undefined), // ROLLBACK
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      await expect(
        paymentService.approveRefundRequest(
          'refund-123',
          'tenant-123',
          'teacher',
          'teacher-123',
          null,
          mockDb
        )
      ).rejects.toThrow('Refund request is already approved');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if refund request not found', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SELECT returns empty
          .mockResolvedValueOnce(undefined), // ROLLBACK
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      await expect(
        paymentService.approveRefundRequest(
          'nonexistent',
          'tenant-123',
          'teacher',
          'teacher-123',
          null,
          mockDb
        )
      ).rejects.toThrow('Refund request not found');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error for invalid approver role', async () => {
      await expect(
        paymentService.approveRefundRequest(
          'refund-123',
          'tenant-123',
          'invalid_role',
          'user-123',
          null,
          mockDb
        )
      ).rejects.toThrow('Invalid approver role');
    });

    it('should handle database errors and rollback', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockRejectedValueOnce(new Error('Database error')) // SELECT fails
          .mockResolvedValueOnce(undefined), // ROLLBACK
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      await expect(
        paymentService.approveRefundRequest(
          'refund-123',
          'tenant-123',
          'teacher',
          'teacher-123',
          null,
          mockDb
        )
      ).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('rejectRefundRequest', () => {
    it('should reject refund request', async () => {
      const mockUpdatedRefund = {
        id: 'refund-123',
        tenant_id: 'tenant-123',
        status: 'rejected',
        teacher_approved_by: 'teacher-123',
        teacher_rejection_reason: 'Insufficient documentation',
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockUpdatedRefund] }) // UPDATE
          .mockResolvedValueOnce({ rows: [] }) // INSERT history
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      const result = await paymentService.rejectRefundRequest(
        'refund-123',
        'tenant-123',
        'teacher',
        'teacher-123',
        'Insufficient documentation',
        mockDb
      );

      expect(result.status).toBe('rejected');
      expect(result.teacher_rejection_reason).toBe('Insufficient documentation');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should reject refund request as admin', async () => {
      const mockUpdatedRefund = {
        id: 'refund-123',
        tenant_id: 'tenant-123',
        status: 'rejected',
        admin_approved_by: 'admin-123',
        admin_rejection_reason: 'Policy violation',
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockUpdatedRefund] }) // UPDATE
          .mockResolvedValueOnce({ rows: [] }) // INSERT history
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      const result = await paymentService.rejectRefundRequest(
        'refund-123',
        'tenant-123',
        'admin',
        'admin-123',
        'Policy violation',
        mockDb
      );

      expect(result.status).toBe('rejected');
      expect(result.admin_rejection_reason).toBe('Policy violation');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should reject refund request as finance_manager', async () => {
      const mockUpdatedRefund = {
        id: 'refund-123',
        tenant_id: 'tenant-123',
        status: 'rejected',
        finance_approved_by: 'finance-123',
        finance_rejection_reason: 'Budget constraints',
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockUpdatedRefund] }) // UPDATE
          .mockResolvedValueOnce({ rows: [] }) // INSERT history
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      const result = await paymentService.rejectRefundRequest(
        'refund-123',
        'tenant-123',
        'finance_manager',
        'finance-123',
        'Budget constraints',
        mockDb
      );

      expect(result.status).toBe('rejected');
      expect(result.finance_rejection_reason).toBe('Budget constraints');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if rejection reason not provided', async () => {
      await expect(
        paymentService.rejectRefundRequest(
          'refund-123',
          'tenant-123',
          'teacher',
          'teacher-123',
          '',
          mockDb
        )
      ).rejects.toThrow('Rejection reason is required');
    });

    it('should throw error for invalid approver role', async () => {
      await expect(
        paymentService.rejectRefundRequest(
          'refund-123',
          'tenant-123',
          'invalid_role',
          'user-123',
          'Test reason',
          mockDb
        )
      ).rejects.toThrow('Invalid approver role');
    });

    it('should throw error if refund request not found', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // UPDATE returns empty
          .mockResolvedValueOnce(undefined), // ROLLBACK
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      await expect(
        paymentService.rejectRefundRequest(
          'nonexistent',
          'tenant-123',
          'teacher',
          'teacher-123',
          'Test reason',
          mockDb
        )
      ).rejects.toThrow('Refund request not found');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle database errors and rollback', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockRejectedValueOnce(new Error('Database error')) // UPDATE fails
          .mockResolvedValueOnce(undefined), // ROLLBACK
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      await expect(
        paymentService.rejectRefundRequest(
          'refund-123',
          'tenant-123',
          'teacher',
          'teacher-123',
          'Test reason',
          mockDb
        )
      ).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('processRefund', () => {
    it('should process approved refund with Razorpay', async () => {
      const mockRefund = {
        id: 'refund-123',
        tenant_id: 'tenant-123',
        payment_id: 'payment-123',
        invoice_id: 'invoice-123',
        refund_amount: 50000,
        refund_type: 'partial',
        reason: 'Customer request',
        status: 'approved',
      };

      const mockPayment = {
        id: 'payment-123',
        payment_id: 'pay_razorpay123',
        gateway: 'razorpay',
      };

      const mockUpdatedRefund = {
        ...mockRefund,
        status: 'processed',
        processed_by: 'finance-123',
        gateway_refund_id: 'rfnd_123',
        gateway_status: 'processed',
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockRefund] }) // SELECT refund
          .mockResolvedValueOnce({ rows: [mockPayment] }) // SELECT payment
          .mockResolvedValueOnce({ rows: [mockUpdatedRefund] }) // UPDATE refund
          .mockResolvedValueOnce({ rows: [{ credit_note_number: 'CN-2026-02-0001', credit_note_year: 2026, credit_note_month: 2, credit_note_sequence: 1 }] }) // generate credit note number
          .mockResolvedValueOnce({ rows: [{}] }) // INSERT credit note
          .mockResolvedValueOnce({ rows: [] }) // UPDATE invoice
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      // Mock Razorpay refund
      paymentService.razorpay = {
        payments: {
          refund: jest.fn().mockResolvedValue({
            id: 'rfnd_123',
            payment_id: 'pay_razorpay123',
            amount: 50000,
            currency: 'INR',
            status: 'processed',
            created_at: Date.now() / 1000,
          }),
        },
      };

      const result = await paymentService.processRefund(
        'refund-123',
        'tenant-123',
        'finance-123',
        mockDb
      );

      expect(result.status).toBe('processed');
      expect(result.gateway_refund_id).toBe('rfnd_123');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should process approved refund with Stripe', async () => {
      const mockRefund = {
        id: 'refund-123',
        tenant_id: 'tenant-123',
        payment_id: 'payment-123',
        invoice_id: 'invoice-123',
        refund_amount: 50000,
        refund_type: 'partial',
        reason: 'Customer request',
        status: 'approved',
      };

      const mockPayment = {
        id: 'payment-123',
        payment_id: 'pi_stripe123',
        gateway: 'stripe',
      };

      const mockUpdatedRefund = {
        ...mockRefund,
        status: 'processed',
        processed_by: 'finance-123',
        gateway_refund_id: 're_stripe123',
        gateway_status: 'succeeded',
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockRefund] }) // SELECT refund
          .mockResolvedValueOnce({ rows: [mockPayment] }) // SELECT payment
          .mockResolvedValueOnce({ rows: [mockUpdatedRefund] }) // UPDATE refund
          .mockResolvedValueOnce({ rows: [{ credit_note_number: 'CN-2026-02-0001', credit_note_year: 2026, credit_note_month: 2, credit_note_sequence: 1 }] })
          .mockResolvedValueOnce({ rows: [{}] }) // INSERT credit note
          .mockResolvedValueOnce({ rows: [] }) // UPDATE invoice
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      // Mock Stripe refund
      paymentService.stripe = {
        refunds: {
          create: jest.fn().mockResolvedValue({
            id: 're_stripe123',
            payment_intent: 'pi_stripe123',
            amount: 50000,
            currency: 'inr',
            status: 'succeeded',
            created: Date.now() / 1000,
          }),
        },
      };

      const result = await paymentService.processRefund(
        'refund-123',
        'tenant-123',
        'finance-123',
        mockDb
      );

      expect(result.status).toBe('processed');
      expect(result.gateway_refund_id).toBe('re_stripe123');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should process refund without payment (invoice-only refund)', async () => {
      const mockRefund = {
        id: 'refund-123',
        tenant_id: 'tenant-123',
        payment_id: null,
        invoice_id: 'invoice-123',
        refund_amount: 50000,
        refund_type: 'full',
        reason: 'Invoice cancelled',
        status: 'approved',
      };

      const mockUpdatedRefund = {
        ...mockRefund,
        status: 'processed',
        processed_by: 'finance-123',
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockRefund] }) // SELECT refund
          .mockResolvedValueOnce({ rows: [mockUpdatedRefund] }) // UPDATE refund
          .mockResolvedValueOnce({ rows: [{ credit_note_number: 'CN-2026-02-0001', credit_note_year: 2026, credit_note_month: 2, credit_note_sequence: 1 }] })
          .mockResolvedValueOnce({ rows: [{}] }) // INSERT credit note
          .mockResolvedValueOnce({ rows: [] }) // UPDATE invoice
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      const result = await paymentService.processRefund(
        'refund-123',
        'tenant-123',
        'finance-123',
        mockDb
      );

      expect(result.status).toBe('processed');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should continue processing even if gateway refund fails', async () => {
      const mockRefund = {
        id: 'refund-123',
        tenant_id: 'tenant-123',
        payment_id: 'payment-123',
        invoice_id: 'invoice-123',
        refund_amount: 50000,
        refund_type: 'partial',
        reason: 'Customer request',
        status: 'approved',
      };

      const mockPayment = {
        id: 'payment-123',
        payment_id: 'pay_razorpay123',
        gateway: 'razorpay',
      };

      const mockUpdatedRefund = {
        ...mockRefund,
        status: 'processed',
        processed_by: 'finance-123',
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockRefund] }) // SELECT refund
          .mockResolvedValueOnce({ rows: [mockPayment] }) // SELECT payment
          .mockResolvedValueOnce({ rows: [mockUpdatedRefund] }) // UPDATE refund
          .mockResolvedValueOnce({ rows: [{ credit_note_number: 'CN-2026-02-0001', credit_note_year: 2026, credit_note_month: 2, credit_note_sequence: 1 }] })
          .mockResolvedValueOnce({ rows: [{}] }) // INSERT credit note
          .mockResolvedValueOnce({ rows: [] }) // UPDATE invoice
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      // Mock Razorpay refund failure
      paymentService.razorpay = {
        payments: {
          refund: jest.fn().mockRejectedValue(new Error('Gateway error')),
        },
      };

      const result = await paymentService.processRefund(
        'refund-123',
        'tenant-123',
        'finance-123',
        mockDb
      );

      expect(result.status).toBe('processed');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if refund not approved', async () => {
      const mockRefund = {
        id: 'refund-123',
        status: 'pending',
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockRefund] }) // SELECT
          .mockResolvedValueOnce(undefined), // ROLLBACK
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      await expect(
        paymentService.processRefund(
          'refund-123',
          'tenant-123',
          'finance-123',
          mockDb
        )
      ).rejects.toThrow('Refund request must be approved before processing');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if refund request not found', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SELECT returns empty
          .mockResolvedValueOnce(undefined), // ROLLBACK
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      await expect(
        paymentService.processRefund(
          'nonexistent',
          'tenant-123',
          'finance-123',
          mockDb
        )
      ).rejects.toThrow('Refund request not found');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle database errors and rollback', async () => {
      const mockRefund = {
        id: 'refund-123',
        status: 'approved',
        payment_id: 'payment-123',
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockRefund] }) // SELECT refund
          .mockRejectedValueOnce(new Error('Database error')) // SELECT payment fails
          .mockResolvedValueOnce(undefined), // ROLLBACK
        release: jest.fn(),
      };

      mockDb.connect.mockResolvedValue(mockClient);

      await expect(
        paymentService.processRefund(
          'refund-123',
          'tenant-123',
          'finance-123',
          mockDb
        )
      ).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getRefundApprovalHistory', () => {
    it('should get refund approval history', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          refund_request_id: 'refund-123',
          approver_role: 'teacher',
          approver_id: 'teacher-123',
          action: 'approved',
          comments: 'Looks good',
          created_at: new Date(),
        },
        {
          id: 'history-2',
          refund_request_id: 'refund-123',
          approver_role: 'admin',
          approver_id: 'admin-123',
          action: 'approved',
          comments: null,
          created_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockHistory });

      const result = await paymentService.getRefundApprovalHistory('refund-123', 'tenant-123', mockDb);

      expect(result).toHaveLength(2);
      expect(result[0].approver_role).toBe('teacher');
      expect(result[1].approver_role).toBe('admin');
    });
  });

  describe('formatRefundRequest', () => {
    it('should format refund request correctly', () => {
      const mockRow = {
        id: 'refund-123',
        tenant_id: 'tenant-123',
        payment_id: 'payment-123',
        invoice_id: null,
        refund_amount: 50000,
        currency: 'INR',
        refund_type: 'partial',
        reason: 'Test',
        supporting_documents: ['doc1.pdf'],
        status: 'pending',
        requested_by: 'user-123',
        teacher_approved_by: null,
        teacher_approved_at: null,
        teacher_rejection_reason: null,
        admin_approved_by: null,
        admin_approved_at: null,
        admin_rejection_reason: null,
        finance_approved_by: null,
        finance_approved_at: null,
        finance_rejection_reason: null,
        processed_by: null,
        processed_at: null,
        gateway_refund_id: null,
        gateway_status: null,
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      const result = paymentService.formatRefundRequest(mockRow);

      expect(result.id).toBe('refund-123');
      expect(result.refund_amount).toBe(50000);
      expect(result.status).toBe('pending');
    });
  });
});
