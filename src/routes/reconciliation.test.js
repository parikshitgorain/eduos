/**
 * Bank Reconciliation Routes Tests
 */

const request = require('supertest');
const express = require('express');
const reconciliationRouter = require('./reconciliation');
const paymentService = require('../services/paymentService');

// Mock payment service
jest.mock('../services/paymentService');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/v1/finance/reconciliation', reconciliationRouter);

describe('Bank Reconciliation Routes', () => {
  const mockTenantId = 'tenant-123';
  const mockSessionId = 'session-456';
  const mockBankAccountId = 'bank-789';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/finance/reconciliation/upload', () => {
    it('should upload bank statement and create reconciliation session', async () => {
      const mockSession = {
        id: mockSessionId,
        tenant_id: mockTenantId,
        bank_account_id: mockBankAccountId,
        statement_date: '2026-02-01',
        total_bank_transactions: 5,
        status: 'in_progress'
      };

      const csvContent = `Date,Reference,Description,Debit,Credit,Balance
2026-02-01,TXN001,Payment received,0,5000.00,10000.00
2026-02-01,TXN002,Payment received,0,3000.00,13000.00`;

      paymentService.parseBankStatementCSV = jest.fn().mockReturnValue([
        { date: '2026-02-01', reference: 'TXN001', description: 'Payment received', debit: 0, credit: 5000.00, balance: 10000.00, currency: 'INR' },
        { date: '2026-02-01', reference: 'TXN002', description: 'Payment received', debit: 0, credit: 3000.00, balance: 13000.00, currency: 'INR' }
      ]);

      paymentService.uploadBankStatement = jest.fn().mockResolvedValue(mockSession);

      const response = await request(app)
        .post('/api/v1/finance/reconciliation/upload')
        .field('bank_account_id', mockBankAccountId)
        .field('statement_date', '2026-02-01')
        .field('tenant_id', mockTenantId)
        .attach('file', Buffer.from(csvContent), 'statement.csv');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.session).toEqual(mockSession);
      expect(response.body.data.transactions_count).toBe(2);
      expect(paymentService.uploadBankStatement).toHaveBeenCalled();
    });

    it('should return 400 if no file is uploaded', async () => {
      const response = await request(app)
        .post('/api/v1/finance/reconciliation/upload')
        .field('bank_account_id', mockBankAccountId)
        .field('statement_date', '2026-02-01')
        .field('tenant_id', mockTenantId);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No file uploaded');
    });

    it('should return 400 if required fields are missing', async () => {
      const csvContent = 'Date,Reference,Credit\n2026-02-01,TXN001,5000.00';

      const response = await request(app)
        .post('/api/v1/finance/reconciliation/upload')
        .attach('file', Buffer.from(csvContent), 'statement.csv');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 if CSV parsing fails', async () => {
      const csvContent = 'Invalid CSV content';

      paymentService.parseBankStatementCSV = jest.fn().mockImplementation(() => {
        throw new Error('Invalid CSV format');
      });

      const response = await request(app)
        .post('/api/v1/finance/reconciliation/upload')
        .field('bank_account_id', mockBankAccountId)
        .field('statement_date', '2026-02-01')
        .field('tenant_id', mockTenantId)
        .attach('file', Buffer.from(csvContent), 'statement.csv');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to parse CSV');
    });
  });

  describe('POST /api/v1/finance/reconciliation/:sessionId/reconcile', () => {
    it('should perform automatic reconciliation', async () => {
      const mockResults = {
        matched: [{ bank_transaction: {}, payment: {}, confidence: 95 }],
        unmatched_bank: [],
        unmatched_system: [],
        discrepancies: []
      };

      paymentService.performReconciliation = jest.fn().mockResolvedValue(mockResults);

      const response = await request(app)
        .post(`/api/v1/finance/reconciliation/${mockSessionId}/reconcile`)
        .send({ tenant_id: mockTenantId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.matched).toBe(1);
      expect(response.body.data.unmatched_bank).toBe(0);
      expect(response.body.data.unmatched_system).toBe(0);
      expect(response.body.data.discrepancies).toBe(0);
      expect(paymentService.performReconciliation).toHaveBeenCalledWith(mockSessionId, mockTenantId, expect.anything());
    });

    it('should return 400 if tenant_id is missing', async () => {
      const response = await request(app)
        .post(`/api/v1/finance/reconciliation/${mockSessionId}/reconcile`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/finance/reconciliation/:sessionId', () => {
    it('should get reconciliation session details', async () => {
      const mockSession = {
        id: mockSessionId,
        tenant_id: mockTenantId,
        status: 'completed',
        matched_count: 5,
        unmatched_bank_count: 1,
        unmatched_system_count: 0,
        discrepancy_count: 1,
        matches: []
      };

      paymentService.getReconciliationSession = jest.fn().mockResolvedValue(mockSession);

      const response = await request(app)
        .get(`/api/v1/finance/reconciliation/${mockSessionId}`)
        .query({ tenant_id: mockTenantId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSession);
      expect(paymentService.getReconciliationSession).toHaveBeenCalledWith(mockSessionId, mockTenantId, expect.anything());
    });

    it('should return 404 if session not found', async () => {
      paymentService.getReconciliationSession = jest.fn().mockRejectedValue(
        new Error('Reconciliation session not found')
      );

      const response = await request(app)
        .get(`/api/v1/finance/reconciliation/${mockSessionId}`)
        .query({ tenant_id: mockTenantId });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 if tenant_id is missing', async () => {
      const response = await request(app)
        .get(`/api/v1/finance/reconciliation/${mockSessionId}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/finance/reconciliation', () => {
    it('should list reconciliation sessions', async () => {
      const mockSessions = [
        { id: 'session-1', status: 'completed', matched_count: 10 },
        { id: 'session-2', status: 'in_progress', matched_count: 5 }
      ];

      paymentService.listReconciliationSessions = jest.fn().mockResolvedValue(mockSessions);

      const response = await request(app)
        .get('/api/v1/finance/reconciliation')
        .query({ tenant_id: mockTenantId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSessions);
      expect(response.body.count).toBe(2);
    });

    it('should filter sessions by status', async () => {
      const mockSessions = [
        { id: 'session-1', status: 'completed', matched_count: 10 }
      ];

      paymentService.listReconciliationSessions = jest.fn().mockResolvedValue(mockSessions);

      const response = await request(app)
        .get('/api/v1/finance/reconciliation')
        .query({ tenant_id: mockTenantId, status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(paymentService.listReconciliationSessions).toHaveBeenCalledWith(
        mockTenantId,
        expect.anything(),
        expect.objectContaining({ status: 'completed' })
      );
    });
  });

  describe('POST /api/v1/finance/reconciliation/:sessionId/manual-match', () => {
    it('should manually match a bank transaction with a payment', async () => {
      const mockMatch = {
        id: 'match-123',
        match_type: 'manual_match',
        match_confidence: 100,
        resolution_status: 'resolved'
      };

      paymentService.manuallyMatchTransaction = jest.fn().mockResolvedValue(mockMatch);

      const response = await request(app)
        .post(`/api/v1/finance/reconciliation/${mockSessionId}/manual-match`)
        .send({
          tenant_id: mockTenantId,
          bank_transaction_id: 'bank-txn-123',
          payment_id: 'payment-456',
          notes: 'Manual match due to reference mismatch',
          resolved_by: 'user-789'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockMatch);
      expect(paymentService.manuallyMatchTransaction).toHaveBeenCalled();
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post(`/api/v1/finance/reconciliation/${mockSessionId}/manual-match`)
        .send({ tenant_id: mockTenantId });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/finance/reconciliation/:sessionId/complete', () => {
    it('should complete reconciliation session', async () => {
      const mockSession = {
        id: mockSessionId,
        status: 'completed',
        reconciled_by: 'user-789',
        reconciled_at: new Date()
      };

      paymentService.completeReconciliation = jest.fn().mockResolvedValue(mockSession);

      const response = await request(app)
        .post(`/api/v1/finance/reconciliation/${mockSessionId}/complete`)
        .send({
          tenant_id: mockTenantId,
          reconciled_by: 'user-789'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('completed');
      expect(paymentService.completeReconciliation).toHaveBeenCalledWith(
        mockSessionId,
        mockTenantId,
        'user-789',
        expect.anything()
      );
    });
  });

  describe('GET /api/v1/finance/reconciliation/:sessionId/export', () => {
    it('should export reconciliation report as HTML', async () => {
      const mockSession = {
        id: mockSessionId,
        tenant_id: mockTenantId,
        statement_date: '2026-02-01',
        status: 'completed',
        total_bank_transactions: 10,
        matched_count: 8,
        unmatched_bank_count: 1,
        unmatched_system_count: 0,
        discrepancy_count: 1,
        matches: [
          {
            match_type: 'matched',
            bank_transaction: { date: '2026-02-01', reference: 'TXN001', credit_amount: 5000 },
            payment: { gateway_transaction_id: 'PAY001', amount: 500000 }
          }
        ]
      };

      paymentService.getReconciliationSession = jest.fn().mockResolvedValue(mockSession);

      const response = await request(app)
        .get(`/api/v1/finance/reconciliation/${mockSessionId}/export`)
        .query({ tenant_id: mockTenantId });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain('Bank Reconciliation Report');
      expect(response.text).toContain(mockSessionId);
    });
  });
});

describe('CSV Parsing', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.restoreAllMocks();
  });

  it('should parse valid CSV bank statement', () => {
    const csvContent = `Date,Reference,Description,Debit,Credit,Balance
2026-02-01,TXN001,Payment received,0,5000.00,10000.00
2026-02-02,TXN002,Payment received,0,3000.00,13000.00
2026-02-03,TXN003,Withdrawal,2000.00,0,11000.00`;

    // Use the actual implementation
    const actualPaymentService = jest.requireActual('../services/paymentService');
    const transactions = actualPaymentService.parseBankStatementCSV(csvContent);

    expect(transactions).toHaveLength(3);
    expect(transactions[0]).toMatchObject({
      date: '2026-02-01',
      reference: 'TXN001',
      description: 'Payment received',
      debit: 0,
      credit: 5000.00,
      balance: 10000.00,
      currency: 'INR'
    });
  });

  it('should handle CSV with different column names', () => {
    const csvContent = `Transaction Date,Txn Ref,Narration,Withdrawal,Deposit,Closing Balance
2026-02-01,TXN001,Payment,0,5000.00,10000.00`;

    const actualPaymentService = jest.requireActual('../services/paymentService');
    const transactions = actualPaymentService.parseBankStatementCSV(csvContent);

    expect(transactions).toHaveLength(1);
    expect(transactions[0].date).toBe('2026-02-01');
  });

  it('should throw error for invalid CSV format', () => {
    const csvContent = 'Invalid CSV\nNo date column here';

    const actualPaymentService = jest.requireActual('../services/paymentService');
    
    expect(() => {
      actualPaymentService.parseBankStatementCSV(csvContent);
    }).toThrow('CSV must contain a date column');
  });

  it('should throw error for empty CSV', () => {
    const csvContent = 'Date,Reference,Credit';

    const actualPaymentService = jest.requireActual('../services/paymentService');
    
    expect(() => {
      actualPaymentService.parseBankStatementCSV(csvContent);
    }).toThrow('Invalid CSV format: no data rows');
  });

  it('should handle CSV with empty lines', () => {
    const csvContent = `Date,Reference,Credit

2026-02-01,TXN001,5000.00

2026-02-02,TXN002,3000.00`;

    const actualPaymentService = jest.requireActual('../services/paymentService');
    const transactions = actualPaymentService.parseBankStatementCSV(csvContent);

    expect(transactions).toHaveLength(2);
  });

  it('should handle CSV with missing optional columns', () => {
    const csvContent = `Date,Credit
2026-02-01,5000.00
2026-02-02,3000.00`;

    const actualPaymentService = jest.requireActual('../services/paymentService');
    const transactions = actualPaymentService.parseBankStatementCSV(csvContent);

    expect(transactions).toHaveLength(2);
    expect(transactions[0].reference).toBeNull();
    expect(transactions[0].description).toBeNull();
  });
});

describe('Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle upload error gracefully', async () => {
    paymentService.uploadBankStatement = jest.fn().mockRejectedValue(
      new Error('Database connection failed')
    );

    const csvContent = 'Date,Credit\n2026-02-01,5000.00';

    paymentService.parseBankStatementCSV = jest.fn().mockReturnValue([
      { date: '2026-02-01', credit: 5000.00, currency: 'INR' }
    ]);

    const response = await request(app)
      .post('/api/v1/finance/reconciliation/upload')
      .field('bank_account_id', 'bank-123')
      .field('statement_date', '2026-02-01')
      .field('tenant_id', 'tenant-123')
      .attach('file', Buffer.from(csvContent), 'statement.csv');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Database connection failed');
  });

  it('should handle reconciliation error gracefully', async () => {
    paymentService.performReconciliation = jest.fn().mockRejectedValue(
      new Error('Session not found')
    );

    const response = await request(app)
      .post('/api/v1/finance/reconciliation/session-123/reconcile')
      .send({ tenant_id: 'tenant-123' });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
  });

  it('should handle manual match error gracefully', async () => {
    paymentService.manuallyMatchTransaction = jest.fn().mockRejectedValue(
      new Error('Transaction already matched')
    );

    const response = await request(app)
      .post('/api/v1/finance/reconciliation/session-123/manual-match')
      .send({
        tenant_id: 'tenant-123',
        bank_transaction_id: 'bank-txn-123',
        payment_id: 'payment-456'
      });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
  });

  it('should handle complete reconciliation error gracefully', async () => {
    paymentService.completeReconciliation = jest.fn().mockRejectedValue(
      new Error('Session already completed')
    );

    const response = await request(app)
      .post('/api/v1/finance/reconciliation/session-123/complete')
      .send({ tenant_id: 'tenant-123' });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
  });

  it('should handle export error gracefully', async () => {
    paymentService.getReconciliationSession = jest.fn().mockRejectedValue(
      new Error('Session not found')
    );

    const response = await request(app)
      .get('/api/v1/finance/reconciliation/session-123/export')
      .query({ tenant_id: 'tenant-123' });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
  });

  it('should handle list sessions error gracefully', async () => {
    paymentService.listReconciliationSessions = jest.fn().mockRejectedValue(
      new Error('Database error')
    );

    const response = await request(app)
      .get('/api/v1/finance/reconciliation')
      .query({ tenant_id: 'tenant-123' });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
  });
});

describe('Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle upload with no transactions', async () => {
    const csvContent = 'Date,Credit';

    paymentService.parseBankStatementCSV = jest.fn().mockReturnValue([]);

    const response = await request(app)
      .post('/api/v1/finance/reconciliation/upload')
      .field('bank_account_id', 'bank-123')
      .field('statement_date', '2026-02-01')
      .field('tenant_id', 'tenant-123')
      .attach('file', Buffer.from(csvContent), 'statement.csv');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('No transactions found in the uploaded file');
  });

  it('should handle reconciliation with all matched', async () => {
    const mockResults = {
      matched: [
        { bank_transaction: {}, payment: {}, confidence: 95 },
        { bank_transaction: {}, payment: {}, confidence: 90 }
      ],
      unmatched_bank: [],
      unmatched_system: [],
      discrepancies: []
    };

    paymentService.performReconciliation = jest.fn().mockResolvedValue(mockResults);

    const response = await request(app)
      .post('/api/v1/finance/reconciliation/session-123/reconcile')
      .send({ tenant_id: 'tenant-123' });

    expect(response.status).toBe(200);
    expect(response.body.data.matched).toBe(2);
    expect(response.body.data.unmatched_bank).toBe(0);
  });

  it('should handle reconciliation with all unmatched', async () => {
    const mockResults = {
      matched: [],
      unmatched_bank: [{ id: 'bank-1' }, { id: 'bank-2' }],
      unmatched_system: [{ id: 'sys-1' }],
      discrepancies: []
    };

    paymentService.performReconciliation = jest.fn().mockResolvedValue(mockResults);

    const response = await request(app)
      .post('/api/v1/finance/reconciliation/session-123/reconcile')
      .send({ tenant_id: 'tenant-123' });

    expect(response.status).toBe(200);
    expect(response.body.data.matched).toBe(0);
    expect(response.body.data.unmatched_bank).toBe(2);
    expect(response.body.data.unmatched_system).toBe(1);
  });

  it('should handle list sessions with pagination', async () => {
    const mockSessions = Array(10).fill(null).map((_, i) => ({
      id: `session-${i}`,
      status: 'completed'
    }));

    paymentService.listReconciliationSessions = jest.fn().mockResolvedValue(mockSessions);

    const response = await request(app)
      .get('/api/v1/finance/reconciliation')
      .query({ tenant_id: 'tenant-123', limit: 10, offset: 0 });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(10);
    expect(paymentService.listReconciliationSessions).toHaveBeenCalledWith(
      'tenant-123',
      expect.anything(),
      expect.objectContaining({ limit: 10, offset: 0 })
    );
  });

  it('should handle list sessions with bank account filter', async () => {
    const mockSessions = [{ id: 'session-1', bank_account_id: 'bank-123' }];

    paymentService.listReconciliationSessions = jest.fn().mockResolvedValue(mockSessions);

    const response = await request(app)
      .get('/api/v1/finance/reconciliation')
      .query({ tenant_id: 'tenant-123', bank_account_id: 'bank-123' });

    expect(response.status).toBe(200);
    expect(paymentService.listReconciliationSessions).toHaveBeenCalledWith(
      'tenant-123',
      expect.anything(),
      expect.objectContaining({ bankAccountId: 'bank-123' })
    );
  });

  it('should handle export with empty matches', async () => {
    const mockSession = {
      id: 'session-123',
      tenant_id: 'tenant-123',
      statement_date: '2026-02-01',
      status: 'completed',
      total_bank_transactions: 0,
      matched_count: 0,
      unmatched_bank_count: 0,
      unmatched_system_count: 0,
      discrepancy_count: 0,
      matches: []
    };

    paymentService.getReconciliationSession = jest.fn().mockResolvedValue(mockSession);

    const response = await request(app)
      .get('/api/v1/finance/reconciliation/session-123/export')
      .query({ tenant_id: 'tenant-123' });

    expect(response.status).toBe(200);
    expect(response.text).toContain('Bank Reconciliation Report');
    expect(response.text).toContain('No matched transactions');
  });

  it('should handle export with all match types', async () => {
    const mockSession = {
      id: 'session-123',
      tenant_id: 'tenant-123',
      statement_date: '2026-02-01',
      status: 'completed',
      total_bank_transactions: 4,
      matched_count: 1,
      unmatched_bank_count: 1,
      unmatched_system_count: 1,
      discrepancy_count: 1,
      matches: [
        {
          match_type: 'matched',
          bank_transaction: { date: '2026-02-01', reference: 'TXN001', credit_amount: 5000 },
          payment: { gateway_transaction_id: 'PAY001', amount: 500000 }
        },
        {
          match_type: 'unmatched_bank',
          bank_transaction: { date: '2026-02-01', reference: 'TXN002', credit_amount: 3000 },
          payment: null
        },
        {
          match_type: 'unmatched_system',
          bank_transaction: null,
          payment: { gateway_transaction_id: 'PAY002', amount: 200000 }
        },
        {
          match_type: 'discrepancy',
          bank_transaction: { date: '2026-02-01', reference: 'TXN003', credit_amount: 1000 },
          payment: { gateway_transaction_id: 'PAY003', amount: 99000 },
          amount_difference: 1000
        }
      ]
    };

    paymentService.getReconciliationSession = jest.fn().mockResolvedValue(mockSession);

    const response = await request(app)
      .get('/api/v1/finance/reconciliation/session-123/export')
      .query({ tenant_id: 'tenant-123' });

    expect(response.status).toBe(200);
    expect(response.text).toContain('Matched Transactions');
    expect(response.text).toContain('Unmatched Bank Transactions');
    expect(response.text).toContain('Unmatched System Payments');
    expect(response.text).toContain('Discrepancies');
  });

  it('should handle upload with uploaded_by parameter', async () => {
    const mockSession = {
      id: 'session-456',
      tenant_id: 'tenant-123',
      status: 'in_progress'
    };

    const csvContent = 'Date,Credit\n2026-02-01,5000.00';

    paymentService.parseBankStatementCSV = jest.fn().mockReturnValue([
      { date: '2026-02-01', credit: 5000.00, currency: 'INR' }
    ]);

    paymentService.uploadBankStatement = jest.fn().mockResolvedValue(mockSession);

    const response = await request(app)
      .post('/api/v1/finance/reconciliation/upload')
      .field('bank_account_id', 'bank-123')
      .field('statement_date', '2026-02-01')
      .field('tenant_id', 'tenant-123')
      .field('uploaded_by', 'user-789')
      .attach('file', Buffer.from(csvContent), 'statement.csv');

    expect(response.status).toBe(201);
    expect(paymentService.uploadBankStatement).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadedBy: 'user-789'
      }),
      expect.anything()
    );
  });

  it('should handle complete reconciliation without reconciled_by', async () => {
    const mockSession = {
      id: 'session-123',
      status: 'completed',
      reconciled_by: null
    };

    paymentService.completeReconciliation = jest.fn().mockResolvedValue(mockSession);

    const response = await request(app)
      .post('/api/v1/finance/reconciliation/session-123/complete')
      .send({ tenant_id: 'tenant-123' });

    expect(response.status).toBe(200);
    expect(paymentService.completeReconciliation).toHaveBeenCalledWith(
      'session-123',
      'tenant-123',
      null,
      expect.anything()
    );
  });

  it('should handle manual match without notes', async () => {
    const mockMatch = {
      id: 'match-123',
      match_type: 'manual_match',
      resolution_notes: null
    };

    paymentService.manuallyMatchTransaction = jest.fn().mockResolvedValue(mockMatch);

    const response = await request(app)
      .post('/api/v1/finance/reconciliation/session-123/manual-match')
      .send({
        tenant_id: 'tenant-123',
        bank_transaction_id: 'bank-txn-123',
        payment_id: 'payment-456'
      });

    expect(response.status).toBe(200);
    expect(paymentService.manuallyMatchTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: null
      }),
      expect.anything()
    );
  });
});
