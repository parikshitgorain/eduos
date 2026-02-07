/**
 * Bank Reconciliation Tests for Payment Service
 * 
 * Tests for bank reconciliation functionality including:
 * - Upload bank statement
 * - Perform reconciliation
 * - Get reconciliation session
 * - List reconciliation sessions
 * - Manual matching
 * - Complete reconciliation
 * - CSV parsing
 */

const paymentService = require('./paymentService');

describe('PaymentService - Bank Reconciliation', () => {
  let mockDb;
  let mockClient;

  beforeEach(() => {
    // Mock database client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    mockDb = {
      connect: jest.fn().mockResolvedValue(mockClient),
      query: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadBankStatement', () => {
    const validParams = {
      tenantId: 'tenant-123',
      bankAccountId: 'account-123',
      statementDate: new Date('2026-02-01'),
      fileName: 'statement.csv',
      fileUrl: 'https://example.com/statement.csv',
      transactions: [
        {
          date: new Date('2026-02-01'),
          reference: 'TXN001',
          description: 'Payment received',
          credit: 5000,
          debit: 0,
          balance: 5000,
          currency: 'INR'
        }
      ],
      uploadedBy: 'user-123'
    };

    it('should upload bank statement successfully', async () => {
      const mockSession = {
        id: 'session-123',
        tenant_id: 'tenant-123',
        bank_account_id: 'account-123',
        statement_date: new Date('2026-02-01'),
        statement_file_name: 'statement.csv',
        total_bank_transactions: 1,
        status: 'in_progress'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockSession] }) // INSERT session
        .mockResolvedValueOnce({ rows: [] }) // INSERT transaction
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await paymentService.uploadBankStatement(validParams, mockDb);

      expect(result).toEqual({
        id: 'session-123',
        tenant_id: 'tenant-123',
        bank_account_id: 'account-123',
        statement_date: mockSession.statement_date,
        statement_file_name: 'statement.csv',
        statement_file_url: undefined,
        status: 'in_progress',
        total_bank_transactions: 1,
        matched_count: undefined,
        unmatched_bank_count: undefined,
        unmatched_system_count: undefined,
        discrepancy_count: undefined,
        reconciled_by: undefined,
        reconciled_at: undefined,
        metadata: undefined,
        created_at: undefined,
        updated_at: undefined
      });

      expect(mockDb.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if database client is missing', async () => {
      await expect(
        paymentService.uploadBankStatement(validParams, null)
      ).rejects.toThrow('Database client is required');
    });

    it('should throw error if transactions array is empty', async () => {
      const params = { ...validParams, transactions: [] };
      
      await expect(
        paymentService.uploadBankStatement(params, mockDb)
      ).rejects.toThrow('Transactions array is required');
    });

    it('should throw error if transactions is not an array', async () => {
      const params = { ...validParams, transactions: null };
      
      await expect(
        paymentService.uploadBankStatement(params, mockDb)
      ).rejects.toThrow('Transactions array is required');
    });

    it('should handle multiple transactions', async () => {
      const params = {
        ...validParams,
        transactions: [
          {
            date: new Date('2026-02-01'),
            reference: 'TXN001',
            description: 'Payment 1',
            credit: 5000,
            debit: 0
          },
          {
            date: new Date('2026-02-02'),
            reference: 'TXN002',
            description: 'Payment 2',
            credit: 3000,
            debit: 0
          }
        ]
      };

      const mockSession = {
        id: 'session-123',
        tenant_id: 'tenant-123',
        bank_account_id: 'account-123',
        statement_date: new Date('2026-02-01'),
        statement_file_name: 'statement.csv',
        total_bank_transactions: 2,
        status: 'in_progress'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockSession] }) // INSERT session
        .mockResolvedValueOnce({ rows: [] }) // INSERT transaction 1
        .mockResolvedValueOnce({ rows: [] }) // INSERT transaction 2
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await paymentService.uploadBankStatement(params, mockDb);

      expect(result.total_bank_transactions).toBe(2);
      expect(mockClient.query).toHaveBeenCalledTimes(5); // BEGIN + INSERT session + 2 transactions + COMMIT
    });

    it('should rollback on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // INSERT session fails

      await expect(
        paymentService.uploadBankStatement(validParams, mockDb)
      ).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle transactions without optional fields', async () => {
      const params = {
        ...validParams,
        transactions: [
          {
            date: new Date('2026-02-01'),
            credit: 5000,
            debit: 0
            // No reference, description, balance, currency, metadata
          }
        ]
      };

      const mockSession = {
        id: 'session-123',
        tenant_id: 'tenant-123',
        bank_account_id: 'account-123',
        statement_date: new Date('2026-02-01'),
        statement_file_name: 'statement.csv',
        total_bank_transactions: 1,
        status: 'in_progress'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockSession] }) // INSERT session
        .mockResolvedValueOnce({ rows: [] }) // INSERT transaction
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await paymentService.uploadBankStatement(params, mockDb);

      expect(result).toBeDefined();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO bank_transactions'),
        expect.arrayContaining([
          'tenant-123',
          'session-123',
          'account-123',
          expect.any(Date),
          null, // reference
          null, // description
          0, // debit
          5000, // credit
          null, // balance
          'INR', // default currency
          '{}' // empty metadata
        ])
      );
    });

    it('should work with non-transactional db client', async () => {
      const simpleDb = {
        query: jest.fn()
      };

      const mockSession = {
        id: 'session-123',
        tenant_id: 'tenant-123',
        bank_account_id: 'account-123',
        statement_date: new Date('2026-02-01'),
        statement_file_name: 'statement.csv',
        total_bank_transactions: 1,
        status: 'in_progress'
      };

      simpleDb.query
        .mockResolvedValueOnce({ rows: [mockSession] }) // INSERT session
        .mockResolvedValueOnce({ rows: [] }); // INSERT transaction

      const result = await paymentService.uploadBankStatement(validParams, simpleDb);

      expect(result).toBeDefined();
      expect(simpleDb.query).not.toHaveBeenCalledWith('BEGIN');
      expect(simpleDb.query).not.toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('performReconciliation', () => {
    const sessionId = 'session-123';
    const tenantId = 'tenant-123';

    it('should throw error if database client is missing', async () => {
      await expect(
        paymentService.performReconciliation(sessionId, tenantId, null)
      ).rejects.toThrow('Database client is required');
    });

    it('should throw error if session not found', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // SELECT session - not found

      await expect(
        paymentService.performReconciliation(sessionId, tenantId, mockDb)
      ).rejects.toThrow('Reconciliation session not found');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should perform reconciliation successfully', async () => {
      const mockSession = {
        id: 'session-123',
        tenant_id: 'tenant-123',
        bank_account_id: 'account-123',
        status: 'in_progress'
      };

      const mockBankTxns = [
        {
          id: 'bank-1',
          transaction_reference: 'PAY001',
          credit_amount: 5000,
          debit_amount: 0,
          transaction_date: new Date('2026-02-01')
        }
      ];

      const mockSystemPayments = [
        {
          id: 'payment-1',
          gateway_payment_id: 'PAY001',
          amount: 5000,
          created_at: new Date('2026-02-01')
        }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockSession] }) // SELECT session
        .mockResolvedValueOnce({ rows: mockBankTxns }) // SELECT bank transactions
        .mockResolvedValueOnce({ rows: mockSystemPayments }) // SELECT system payments
        .mockResolvedValueOnce({ rows: [] }) // INSERT match
        .mockResolvedValueOnce({ rows: [] }) // UPDATE payment
        .mockResolvedValueOnce({ rows: [] }) // UPDATE session stats
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await paymentService.performReconciliation(sessionId, tenantId, mockDb);

      expect(result).toEqual({
        matched: expect.any(Array),
        unmatched_bank: expect.any(Array),
        unmatched_system: expect.any(Array),
        discrepancies: expect.any(Array)
      });

      // The matching algorithm should find at least one match or categorize transactions
      const totalTransactions = result.matched.length + result.unmatched_bank.length + 
                                result.unmatched_system.length + result.discrepancies.length;
      expect(totalTransactions).toBeGreaterThan(0);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should handle no matches found', async () => {
      const mockSession = {
        id: 'session-123',
        tenant_id: 'tenant-123',
        bank_account_id: 'account-123',
        status: 'in_progress'
      };

      const mockBankTxns = [
        {
          id: 'bank-1',
          transaction_reference: 'PAY001',
          credit_amount: 5000,
          transaction_date: new Date('2026-02-01')
        }
      ];

      const mockSystemPayments = [
        {
          id: 'payment-1',
          gateway_payment_id: 'PAY999', // Different reference
          amount: 3000, // Different amount
          created_at: new Date('2026-02-05') // Different date
        }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockSession] }) // SELECT session
        .mockResolvedValueOnce({ rows: mockBankTxns }) // SELECT bank transactions
        .mockResolvedValueOnce({ rows: mockSystemPayments }) // SELECT system payments
        .mockResolvedValueOnce({ rows: [] }) // UPDATE session
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await paymentService.performReconciliation(sessionId, tenantId, mockDb);

      expect(result.matched).toEqual([]);
      expect(result.unmatched_bank.length + result.unmatched_system.length).toBeGreaterThan(0);
    });

    it('should rollback on error during reconciliation', async () => {
      const mockSession = {
        id: 'session-123',
        tenant_id: 'tenant-123',
        bank_account_id: 'account-123',
        status: 'in_progress'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockSession] }) // SELECT session
        .mockRejectedValueOnce(new Error('Query failed')); // SELECT bank transactions fails

      await expect(
        paymentService.performReconciliation(sessionId, tenantId, mockDb)
      ).rejects.toThrow('Query failed');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getReconciliationSession', () => {
    const sessionId = 'session-123';
    const tenantId = 'tenant-123';

    it('should throw error if database client is missing', async () => {
      await expect(
        paymentService.getReconciliationSession(sessionId, tenantId, null)
      ).rejects.toThrow('Database client is required');
    });

    it('should throw error if session not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        paymentService.getReconciliationSession(sessionId, tenantId, mockDb)
      ).rejects.toThrow('Reconciliation session not found');
    });

    it('should return session with statistics', async () => {
      const mockSession = {
        id: 'session-123',
        tenant_id: 'tenant-123',
        bank_account_id: 'account-123',
        statement_date: new Date('2026-02-01'),
        statement_file_name: 'statement.csv',
        total_bank_transactions: 10,
        matched_count: 8,
        unmatched_bank_count: 1,
        unmatched_system_count: 1,
        discrepancy_count: 1,
        status: 'completed',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockSession] }) // SELECT session
        .mockResolvedValueOnce({ rows: [] }) // SELECT matches
        .mockResolvedValueOnce({ rows: [] }); // SELECT discrepancies

      const result = await paymentService.getReconciliationSession(sessionId, tenantId, mockDb);

      expect(result.id).toBe('session-123');
      expect(result.tenant_id).toBe('tenant-123');
      expect(result.total_bank_transactions).toBe(10);
      expect(result.matched_count).toBe(8);
      expect(result.matches).toEqual([]);
      expect(result.discrepancies).toEqual([]);
    });
  });

  describe('listReconciliationSessions', () => {
    const tenantId = 'tenant-123';

    it('should throw error if database client is missing', async () => {
      await expect(
        paymentService.listReconciliationSessions(tenantId, null, {})
      ).rejects.toThrow('Database client is required');
    });

    it('should list sessions with default pagination', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          tenant_id: 'tenant-123',
          bank_account_id: 'account-123',
          statement_date: new Date('2026-02-01'),
          statement_file_name: 'statement1.csv',
          total_bank_transactions: 10,
          status: 'completed'
        },
        {
          id: 'session-2',
          tenant_id: 'tenant-123',
          bank_account_id: 'account-123',
          statement_date: new Date('2026-02-02'),
          statement_file_name: 'statement2.csv',
          total_bank_transactions: 15,
          status: 'in_progress'
        }
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockSessions });

      const result = await paymentService.listReconciliationSessions(tenantId, mockDb, {});

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('session-1');
      expect(result[1].id).toBe('session-2');
    });

    it('should filter by status', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await paymentService.listReconciliationSessions(
        tenantId,
        mockDb,
        { status: 'completed' }
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.arrayContaining(['tenant-123', 'completed'])
      );
    });

    it('should filter by bank account', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await paymentService.listReconciliationSessions(
        tenantId,
        mockDb,
        { bankAccountId: 'account-123' }
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('bank_account_id'),
        expect.arrayContaining(['tenant-123', 'account-123'])
      );
    });

    it('should handle custom pagination', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await paymentService.listReconciliationSessions(
        tenantId,
        mockDb,
        { limit: 10, offset: 10 }
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 10])
      );
    });
  });

  describe('parseBankStatementCSV', () => {
    it('should parse CSV with standard column names', () => {
      const csvContent = `Date,Reference,Description,Debit,Credit,Balance
2026-02-01,TXN001,Payment received,0,5000,5000
2026-02-02,TXN002,Payment sent,3000,0,2000`;

      const result = paymentService.parseBankStatementCSV(csvContent);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2026-02-01',
        reference: 'TXN001',
        description: 'Payment received',
        debit: 0,
        credit: 5000,
        balance: 5000,
        currency: 'INR'
      });
    });

    it('should parse CSV with alternative column names', () => {
      const csvContent = `Transaction Date,Txn Ref,Narration,Withdrawal,Deposit,Closing Balance
2026-02-01,TXN001,Payment,0,5000,5000`;

      const result = paymentService.parseBankStatementCSV(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2026-02-01');
      expect(result[0].credit).toBe(5000);
    });

    it('should throw error for empty CSV', () => {
      const csvContent = `Date,Reference,Description,Debit,Credit,Balance`;

      expect(() => {
        paymentService.parseBankStatementCSV(csvContent);
      }).toThrow('Invalid CSV format: no data rows');
    });

    it('should handle CSV with missing optional columns', () => {
      const csvContent = `Date,Credit
2026-02-01,5000`;

      const result = paymentService.parseBankStatementCSV(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].credit).toBe(5000);
      expect(result[0].reference).toBeNull();
    });

    it('should throw error for invalid CSV format', () => {
      const csvContent = `Invalid CSV content without proper structure`;

      expect(() => {
        paymentService.parseBankStatementCSV(csvContent);
      }).toThrow();
    });
  });

  describe('formatReconciliationSession', () => {
    it('should format session object correctly', () => {
      const session = {
        id: 'session-123',
        tenant_id: 'tenant-123',
        bank_account_id: 'account-123',
        statement_date: new Date('2026-02-01'),
        statement_file_name: 'statement.csv',
        total_bank_transactions: 10,
        matched_count: 8,
        unmatched_bank_count: 1,
        unmatched_system_count: 1,
        discrepancy_count: 1,
        status: 'completed',
        created_at: new Date(),
        updated_at: new Date()
      };

      const result = paymentService.formatReconciliationSession(session);

      expect(result).toEqual({
        id: 'session-123',
        tenant_id: 'tenant-123',
        bank_account_id: 'account-123',
        statement_date: session.statement_date,
        statement_file_name: 'statement.csv',
        statement_file_url: undefined,
        total_bank_transactions: 10,
        matched_count: 8,
        unmatched_bank_count: 1,
        unmatched_system_count: 1,
        discrepancy_count: 1,
        status: 'completed',
        reconciled_by: undefined,
        reconciled_at: undefined,
        metadata: undefined,
        created_at: session.created_at,
        updated_at: session.updated_at
      });
    });

    it('should handle session with null optional fields', () => {
      const session = {
        id: 'session-123',
        tenant_id: 'tenant-123',
        bank_account_id: 'account-123',
        statement_date: new Date('2026-02-01'),
        statement_file_name: 'statement.csv',
        total_bank_transactions: 10,
        status: 'in_progress'
      };

      const result = paymentService.formatReconciliationSession(session);

      expect(result.matched_count).toBeUndefined();
      expect(result.unmatched_bank_count).toBeUndefined();
      expect(result.discrepancy_count).toBeUndefined();
    });
  });

  describe('manuallyMatchTransaction', () => {
    const params = {
      sessionId: 'session-123',
      bankTransactionId: 'bank-1',
      paymentId: 'payment-1',
      notes: 'Manual match',
      resolvedBy: 'user-123',
      tenantId: 'tenant-123'
    };

    it('should throw error if database client is missing', async () => {
      await expect(
        paymentService.manuallyMatchTransaction(params, null)
      ).rejects.toThrow('Database client is required');
    });

    it('should create new manual match', async () => {
      const mockMatch = {
        id: 'match-123',
        tenant_id: 'tenant-123',
        reconciliation_session_id: 'session-123',
        bank_transaction_id: 'bank-1',
        payment_id: 'payment-1',
        match_type: 'manual_match',
        match_confidence: 100,
        resolution_status: 'resolved'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT existing match - not found
        .mockResolvedValueOnce({ rows: [mockMatch] }) // INSERT new match
        .mockResolvedValueOnce({ rows: [] }) // UPDATE payment
        .mockResolvedValueOnce({ rows: [] }) // UPDATE session stats
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await paymentService.manuallyMatchTransaction(params, mockDb);

      expect(result).toBeDefined();
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should update existing match', async () => {
      const existingMatch = {
        id: 'match-123',
        tenant_id: 'tenant-123',
        bank_transaction_id: 'bank-1'
      };

      const updatedMatch = {
        ...existingMatch,
        payment_id: 'payment-1',
        match_type: 'manual_match',
        match_confidence: 100,
        resolution_status: 'resolved'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [existingMatch] }) // SELECT existing match - found
        .mockResolvedValueOnce({ rows: [updatedMatch] }) // UPDATE match
        .mockResolvedValueOnce({ rows: [] }) // UPDATE payment
        .mockResolvedValueOnce({ rows: [] }) // UPDATE session stats
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await paymentService.manuallyMatchTransaction(params, mockDb);

      expect(result).toBeDefined();
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // SELECT fails

      await expect(
        paymentService.manuallyMatchTransaction(params, mockDb)
      ).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should work with non-transactional db client', async () => {
      const simpleDb = {
        query: jest.fn()
      };

      const mockMatch = {
        id: 'match-123',
        tenant_id: 'tenant-123',
        reconciliation_session_id: 'session-123',
        bank_transaction_id: 'bank-1',
        payment_id: 'payment-1',
        match_type: 'manual_match'
      };

      simpleDb.query
        .mockResolvedValueOnce({ rows: [] }) // SELECT existing match
        .mockResolvedValueOnce({ rows: [mockMatch] }) // INSERT new match
        .mockResolvedValueOnce({ rows: [] }) // UPDATE payment
        .mockResolvedValueOnce({ rows: [] }); // UPDATE session stats

      const result = await paymentService.manuallyMatchTransaction(params, simpleDb);

      expect(result).toBeDefined();
      expect(simpleDb.query).not.toHaveBeenCalledWith('BEGIN');
      expect(simpleDb.query).not.toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('completeReconciliation', () => {
    const sessionId = 'session-123';
    const tenantId = 'tenant-123';
    const reconciledBy = 'user-123';

    it('should throw error if database client is missing', async () => {
      await expect(
        paymentService.completeReconciliation(sessionId, tenantId, reconciledBy, null)
      ).rejects.toThrow('Database client is required');
    });

    it('should complete reconciliation successfully', async () => {
      const mockSession = {
        id: 'session-123',
        tenant_id: 'tenant-123',
        bank_account_id: 'account-123',
        status: 'completed',
        reconciled_by: 'user-123',
        reconciled_at: new Date()
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockSession] });

      const result = await paymentService.completeReconciliation(sessionId, tenantId, reconciledBy, mockDb);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.reconciled_by).toBe('user-123');
    });

    it('should throw error if session not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        paymentService.completeReconciliation(sessionId, tenantId, reconciledBy, mockDb)
      ).rejects.toThrow('Reconciliation session not found');
    });
  });

  describe('formatReconciliationMatch', () => {
    it('should format match object correctly', () => {
      const match = {
        id: 'match-123',
        tenant_id: 'tenant-123',
        reconciliation_session_id: 'session-123',
        bank_transaction_id: 'bank-1',
        payment_id: 'payment-1',
        match_type: 'matched',
        match_confidence: 95,
        amount_difference: 0,
        resolution_status: 'resolved',
        resolution_notes: 'Auto-matched',
        resolved_by: 'system',
        resolved_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      };

      const result = paymentService.formatReconciliationMatch(match);

      expect(result).toBeDefined();
      expect(result.id).toBe('match-123');
      expect(result.tenant_id).toBe('tenant-123');
      expect(result.match_type).toBe('matched');
    });
  });
});
