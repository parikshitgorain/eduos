/**
 * Audit Service Tests
 * 
 * Tests for tamper-evident audit logging with SHA-256 hash chain
 */

const auditService = require('./auditService');

describe('AuditService', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      query: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constants', () => {
    it('should export EVENT_TYPES', () => {
      expect(auditService.EVENT_TYPES).toBeDefined();
      expect(auditService.EVENT_TYPES.USER_LOGIN).toBe('user_login');
      expect(auditService.EVENT_TYPES.DATA_MODIFICATION).toBe('data_modification');
    });

    it('should export ACTIONS', () => {
      expect(auditService.ACTIONS).toBeDefined();
      expect(auditService.ACTIONS.CREATE).toBe('create');
      expect(auditService.ACTIONS.READ).toBe('read');
    });

    it('should export SEVERITY', () => {
      expect(auditService.SEVERITY).toBeDefined();
      expect(auditService.SEVERITY.INFO).toBe('info');
      expect(auditService.SEVERITY.ERROR).toBe('error');
    });
  });

  describe('createAuditLog', () => {
    const validParams = {
      tenantId: 'tenant-123',
      eventType: 'user_login',
      action: 'login',
      userId: 'user-456',
      userEmail: 'user@example.com',
      eventData: { success: true }
    };

    it('should create audit log entry successfully', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'audit-123' }]
      });

      const result = await auditService.createAuditLog(validParams, mockDb);

      expect(result).toBe('audit-123');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT create_audit_log'),
        expect.arrayContaining([
          'tenant-123',
          'user_login',
          'login'
        ])
      );
    });

    it('should throw error if database client is missing', async () => {
      await expect(
        auditService.createAuditLog(validParams, null)
      ).rejects.toThrow('Database client is required');
    });

    it('should throw error if tenantId is missing', async () => {
      const params = { ...validParams, tenantId: null };
      
      await expect(
        auditService.createAuditLog(params, mockDb)
      ).rejects.toThrow('Tenant ID is required');
    });

    it('should throw error if eventType is missing', async () => {
      const params = { ...validParams, eventType: null };
      
      await expect(
        auditService.createAuditLog(params, mockDb)
      ).rejects.toThrow('Event type is required');
    });

    it('should throw error if action is missing', async () => {
      const params = { ...validParams, action: null };
      
      await expect(
        auditService.createAuditLog(params, mockDb)
      ).rejects.toThrow('Action is required');
    });

    it('should handle optional parameters', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'audit-123' }]
      });

      const params = {
        tenantId: 'tenant-123',
        eventType: 'data_modification',
        action: 'update',
        resourceType: 'student',
        resourceId: 'student-789',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        requestId: 'req-123',
        sessionId: 'session-456',
        oldValues: { name: 'Old Name' },
        newValues: { name: 'New Name' },
        severity: 'warning',
        status: 'success',
        errorMessage: null
      };

      const result = await auditService.createAuditLog(params, mockDb);

      expect(result).toBe('audit-123');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'tenant-123',
          'data_modification',
          'update',
          'student',
          'student-789'
        ])
      );
    });

    it('should use default severity and status', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'audit-123' }]
      });

      await auditService.createAuditLog(validParams, mockDb);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['info', 'success'])
      );
    });

    it('should handle error status with error message', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'audit-123' }]
      });

      const params = {
        ...validParams,
        status: 'failure',
        errorMessage: 'Login failed: invalid credentials'
      };

      await auditService.createAuditLog(params, mockDb);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['failure', 'Login failed: invalid credentials'])
      );
    });
  });

  describe('getAuditLogs', () => {
    const mockAuditLogs = [
      {
        id: 'audit-1',
        tenant_id: 'tenant-123',
        event_type: 'user_login',
        action: 'login',
        created_at: new Date()
      },
      {
        id: 'audit-2',
        tenant_id: 'tenant-123',
        event_type: 'data_modification',
        action: 'update',
        created_at: new Date()
      }
    ];

    it('should get audit logs for tenant', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: mockAuditLogs });

      const result = await auditService.getAuditLogs('tenant-123', mockDb);

      expect(result).toEqual(mockAuditLogs);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT *'),
        expect.arrayContaining(['tenant-123', 100, 0])
      );
    });

    it('should throw error if database client is missing', async () => {
      await expect(
        auditService.getAuditLogs('tenant-123', null)
      ).rejects.toThrow('Database client is required');
    });

    it('should throw error if tenantId is missing', async () => {
      await expect(
        auditService.getAuditLogs(null, mockDb)
      ).rejects.toThrow('Tenant ID is required');
    });

    it('should filter by userId', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await auditService.getAuditLogs('tenant-123', mockDb, {
        userId: 'user-456'
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $2'),
        expect.arrayContaining(['tenant-123', 'user-456'])
      );
    });

    it('should filter by eventType', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await auditService.getAuditLogs('tenant-123', mockDb, {
        eventType: 'user_login'
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('event_type = $2'),
        expect.arrayContaining(['tenant-123', 'user_login'])
      );
    });

    it('should filter by action', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await auditService.getAuditLogs('tenant-123', mockDb, {
        action: 'create'
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('action = $2'),
        expect.arrayContaining(['tenant-123', 'create'])
      );
    });

    it('should filter by resourceType', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await auditService.getAuditLogs('tenant-123', mockDb, {
        resourceType: 'student'
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('resource_type = $2'),
        expect.arrayContaining(['tenant-123', 'student'])
      );
    });

    it('should filter by resourceId', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await auditService.getAuditLogs('tenant-123', mockDb, {
        resourceId: 'student-789'
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('resource_id = $2'),
        expect.arrayContaining(['tenant-123', 'student-789'])
      );
    });

    it('should filter by startDate', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const startDate = new Date('2026-01-01');
      await auditService.getAuditLogs('tenant-123', mockDb, {
        startDate
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at >= $2'),
        expect.arrayContaining(['tenant-123', startDate])
      );
    });

    it('should filter by endDate', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const endDate = new Date('2026-12-31');
      await auditService.getAuditLogs('tenant-123', mockDb, {
        endDate
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at <= $2'),
        expect.arrayContaining(['tenant-123', endDate])
      );
    });

    it('should filter by severity', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await auditService.getAuditLogs('tenant-123', mockDb, {
        severity: 'error'
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('severity = $2'),
        expect.arrayContaining(['tenant-123', 'error'])
      );
    });

    it('should handle custom pagination', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await auditService.getAuditLogs('tenant-123', mockDb, {
        limit: 50,
        offset: 10
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([50, 10])
      );
    });

    it('should handle multiple filters', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await auditService.getAuditLogs('tenant-123', mockDb, {
        userId: 'user-456',
        eventType: 'data_modification',
        action: 'update',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31')
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $2'),
        expect.arrayContaining(['tenant-123', 'user-456', 'data_modification', 'update'])
      );
    });
  });

  describe('getAuditLogById', () => {
    it('should get audit log by ID', async () => {
      const mockAuditLog = {
        id: 'audit-123',
        tenant_id: 'tenant-123',
        event_type: 'user_login'
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockAuditLog] });

      const result = await auditService.getAuditLogById('audit-123', 'tenant-123', mockDb);

      expect(result).toEqual(mockAuditLog);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM audit_logs WHERE id = $1 AND tenant_id = $2',
        ['audit-123', 'tenant-123']
      );
    });

    it('should return null if audit log not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await auditService.getAuditLogById('audit-123', 'tenant-123', mockDb);

      expect(result).toBeNull();
    });

    it('should throw error if database client is missing', async () => {
      await expect(
        auditService.getAuditLogById('audit-123', 'tenant-123', null)
      ).rejects.toThrow('Database client is required');
    });

    it('should throw error if ID is missing', async () => {
      await expect(
        auditService.getAuditLogById(null, 'tenant-123', mockDb)
      ).rejects.toThrow('Audit log ID is required');
    });

    it('should throw error if tenantId is missing', async () => {
      await expect(
        auditService.getAuditLogById('audit-123', null, mockDb)
      ).rejects.toThrow('Tenant ID is required');
    });
  });

  describe('verifyAuditIntegrity', () => {
    it('should verify audit integrity successfully', async () => {
      const mockVerification = {
        is_valid: true,
        total_entries: 100,
        invalid_entries: 0,
        first_invalid_id: null,
        first_invalid_created_at: null,
        error_message: null
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockVerification] });

      const result = await auditService.verifyAuditIntegrity('tenant-123', mockDb);

      expect(result).toEqual(mockVerification);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM verify_audit_chain($1::UUID, $2, $3)',
        ['tenant-123', null, null]
      );
    });

    it('should verify with date range', async () => {
      const mockVerification = {
        is_valid: true,
        total_entries: 50,
        invalid_entries: 0
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockVerification] });

      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-12-31');

      await auditService.verifyAuditIntegrity('tenant-123', mockDb, {
        startDate,
        endDate
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM verify_audit_chain($1::UUID, $2, $3)',
        ['tenant-123', startDate, endDate]
      );
    });

    it('should throw error if database client is missing', async () => {
      await expect(
        auditService.verifyAuditIntegrity('tenant-123', null)
      ).rejects.toThrow('Database client is required');
    });

    it('should throw error if tenantId is missing', async () => {
      await expect(
        auditService.verifyAuditIntegrity(null, mockDb)
      ).rejects.toThrow('Tenant ID is required');
    });
  });

  describe('setRetentionPolicy', () => {
    it('should set retention policy', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await auditService.setRetentionPolicy('tenant-123', 'enterprise', mockDb);

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT set_audit_retention_policy($1::UUID, $2)',
        ['tenant-123', 'enterprise']
      );
    });

    it('should throw error if database client is missing', async () => {
      await expect(
        auditService.setRetentionPolicy('tenant-123', 'basic', null)
      ).rejects.toThrow('Database client is required');
    });

    it('should throw error if tenantId is missing', async () => {
      await expect(
        auditService.setRetentionPolicy(null, 'basic', mockDb)
      ).rejects.toThrow('Tenant ID is required');
    });

    it('should throw error if tier is missing', async () => {
      await expect(
        auditService.setRetentionPolicy('tenant-123', null, mockDb)
      ).rejects.toThrow('Tier is required');
    });
  });

  describe('getRetentionPolicy', () => {
    it('should get retention policy', async () => {
      const mockPolicy = {
        id: 'policy-123',
        tenant_id: 'tenant-123',
        retention_days: 36135,
        tier: 'enterprise'
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockPolicy] });

      const result = await auditService.getRetentionPolicy('tenant-123', mockDb);

      expect(result).toEqual(mockPolicy);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM audit_retention_policies WHERE tenant_id = $1',
        ['tenant-123']
      );
    });

    it('should return null if policy not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await auditService.getRetentionPolicy('tenant-123', mockDb);

      expect(result).toBeNull();
    });

    it('should throw error if database client is missing', async () => {
      await expect(
        auditService.getRetentionPolicy('tenant-123', null)
      ).rejects.toThrow('Database client is required');
    });

    it('should throw error if tenantId is missing', async () => {
      await expect(
        auditService.getRetentionPolicy(null, mockDb)
      ).rejects.toThrow('Tenant ID is required');
    });
  });

  describe('exportAuditLogs', () => {
    it('should export audit logs with signature', async () => {
      const mockLogs = [
        { id: 'audit-1', event_type: 'user_login' },
        { id: 'audit-2', event_type: 'data_modification' }
      ];

      const mockVerification = {
        is_valid: true,
        total_entries: 2,
        invalid_entries: 0
      };

      // Mock getAuditLogs
      mockDb.query
        .mockResolvedValueOnce({ rows: mockLogs }) // getAuditLogs
        .mockResolvedValueOnce({ rows: [mockVerification] }); // verifyAuditIntegrity

      const result = await auditService.exportAuditLogs('tenant-123', mockDb);

      expect(result).toHaveProperty('tenant_id', 'tenant-123');
      expect(result).toHaveProperty('export_date');
      expect(result).toHaveProperty('total_entries', 2);
      expect(result).toHaveProperty('integrity_verified', true);
      expect(result).toHaveProperty('logs', mockLogs);
      expect(result).toHaveProperty('signature');
      expect(typeof result.signature).toBe('string');
      expect(result.signature).toHaveLength(64); // SHA-256 hex length
    });

    it('should export with filters', async () => {
      const mockLogs = [];
      const mockVerification = { is_valid: true, total_entries: 0, invalid_entries: 0 };

      mockDb.query
        .mockResolvedValueOnce({ rows: mockLogs })
        .mockResolvedValueOnce({ rows: [mockVerification] });

      const filters = {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        eventType: 'user_login'
      };

      const result = await auditService.exportAuditLogs('tenant-123', mockDb, filters);

      expect(result).toHaveProperty('filters', filters);
    });

    it('should throw error if database client is missing', async () => {
      await expect(
        auditService.exportAuditLogs('tenant-123', null)
      ).rejects.toThrow('Database client is required');
    });

    it('should throw error if tenantId is missing', async () => {
      await expect(
        auditService.exportAuditLogs(null, mockDb)
      ).rejects.toThrow('Tenant ID is required');
    });
  });

  describe('extractUserContext', () => {
    it('should extract user context from request', () => {
      const mockReq = {
        user: {
          id: 'user-123',
          email: 'user@example.com',
          role: 'admin'
        },
        ip: '192.168.1.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
        id: 'req-456',
        session: {
          id: 'session-789'
        }
      };

      const context = auditService.extractUserContext(mockReq);

      expect(context).toEqual({
        userId: 'user-123',
        userEmail: 'user@example.com',
        userRole: 'admin',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        requestId: 'req-456',
        sessionId: 'session-789'
      });
    });

    it('should handle missing user', () => {
      const mockReq = {
        ip: '192.168.1.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0')
      };

      const context = auditService.extractUserContext(mockReq);

      expect(context.userId).toBeNull();
      expect(context.userEmail).toBeNull();
      expect(context.userRole).toBeNull();
    });

    it('should handle missing IP from connection', () => {
      const mockReq = {
        connection: {
          remoteAddress: '10.0.0.1'
        },
        get: jest.fn().mockReturnValue('Mozilla/5.0')
      };

      const context = auditService.extractUserContext(mockReq);

      expect(context.ipAddress).toBe('10.0.0.1');
    });

    it('should handle missing optional fields', () => {
      const mockReq = {
        get: jest.fn().mockReturnValue(undefined)
      };

      const context = auditService.extractUserContext(mockReq);

      expect(context.userId).toBeNull();
      expect(context.ipAddress).toBeNull();
      expect(context.userAgent).toBeNull();
      expect(context.requestId).toBeNull();
      expect(context.sessionId).toBeNull();
    });
  });
});
