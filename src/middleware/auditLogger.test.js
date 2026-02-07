/**
 * Audit Logger Middleware Tests
 */

const auditLogger = require('./auditLogger');
const auditService = require('../services/auditService');

// Mock the audit service
jest.mock('../services/auditService');

describe('Audit Logger Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let mockDb;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    };

    mockReq = {
      method: 'GET',
      path: '/api/v1/students',
      query: {},
      params: {},
      body: {},
      db: mockDb,
      tenantId: 'tenant-123',
      user: {
        id: 'user-456',
        email: 'user@example.com',
        role: 'admin',
      },
      ip: '192.168.1.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
      id: 'req-123',
      session: {
        id: 'session-456',
      },
    };

    mockRes = {
      statusCode: 200,
      end: jest.fn(),
    };

    mockNext = jest.fn();

    auditService.extractUserContext.mockReturnValue({
      userId: 'user-456',
      userEmail: 'user@example.com',
      userRole: 'admin',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      requestId: 'req-123',
      sessionId: 'session-456',
    });

    auditService.createAuditLog.mockResolvedValue('audit-log-id');
    auditService.EVENT_TYPES = {
      DATA_ACCESS: 'data_access',
      DATA_MODIFICATION: 'data_modification',
      USER_LOGIN: 'user_login',
      USER_LOGOUT: 'user_logout',
      LOGIN_FAILED: 'login_failed',
      PERMISSION_GRANTED: 'permission_granted',
      PERMISSION_REVOKED: 'permission_revoked',
    };
    auditService.ACTIONS = {
      READ: 'read',
      CREATE: 'create',
      UPDATE: 'update',
      DELETE: 'delete',
      LOGIN: 'login',
      LOGOUT: 'logout',
      GRANT: 'grant',
      REVOKE: 'revoke',
    };
    auditService.SEVERITY = {
      INFO: 'info',
      WARNING: 'warning',
      ERROR: 'error',
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('auditLogger middleware', () => {
    it('should log GET requests', (done) => {
      const middleware = auditLogger.auditLogger();

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();

      // Simulate response end
      const originalEnd = mockRes.end;
      mockRes.end();

      // Wait for async logging
      setImmediate(() => {
        expect(auditService.createAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId: 'tenant-123',
            eventType: 'data_access',
            action: 'read',
            userId: 'user-456',
          }),
          mockDb
        );
        done();
      });
    });

    it('should log POST requests as CREATE', (done) => {
      mockReq.method = 'POST';
      const middleware = auditLogger.auditLogger();

      middleware(mockReq, mockRes, mockNext);
      mockRes.end();

      setImmediate(() => {
        expect(auditService.createAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: 'data_modification',
            action: 'create',
          }),
          mockDb
        );
        done();
      });
    });

    it('should log PUT requests as UPDATE', (done) => {
      mockReq.method = 'PUT';
      const middleware = auditLogger.auditLogger();

      middleware(mockReq, mockRes, mockNext);
      mockRes.end();

      setImmediate(() => {
        expect(auditService.createAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: 'data_modification',
            action: 'update',
          }),
          mockDb
        );
        done();
      });
    });

    it('should log DELETE requests', (done) => {
      mockReq.method = 'DELETE';
      const middleware = auditLogger.auditLogger();

      middleware(mockReq, mockRes, mockNext);
      mockRes.end();

      setImmediate(() => {
        expect(auditService.createAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: 'data_modification',
            action: 'delete',
          }),
          mockDb
        );
        done();
      });
    });

    it('should skip excluded paths', () => {
      mockReq.path = '/health';
      const middleware = auditLogger.auditLogger({
        excludePaths: ['/health', '/metrics'],
      });

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(auditService.createAuditLog).not.toHaveBeenCalled();
    });

    it('should log error responses with ERROR severity', (done) => {
      mockRes.statusCode = 500;
      const middleware = auditLogger.auditLogger();

      middleware(mockReq, mockRes, mockNext);
      mockRes.end();

      setImmediate(() => {
        expect(auditService.createAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: 'error',
            status: 'failure',
          }),
          mockDb
        );
        done();
      });
    });

    it('should log client errors with WARNING severity', (done) => {
      mockRes.statusCode = 400;
      const middleware = auditLogger.auditLogger();

      middleware(mockReq, mockRes, mockNext);
      mockRes.end();

      setImmediate(() => {
        expect(auditService.createAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: 'warning',
            status: 'failure',
          }),
          mockDb
        );
        done();
      });
    });

    it('should include response time', (done) => {
      const middleware = auditLogger.auditLogger();

      middleware(mockReq, mockRes, mockNext);

      setTimeout(() => {
        mockRes.end();

        setImmediate(() => {
          expect(auditService.createAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
              eventData: expect.objectContaining({
                response_time_ms: expect.any(Number),
              }),
            }),
            mockDb
          );
          done();
        });
      }, 10);
    });

    it('should handle missing db gracefully', () => {
      mockReq.db = null;
      const middleware = auditLogger.auditLogger();

      middleware(mockReq, mockRes, mockNext);
      mockRes.end();

      expect(mockNext).toHaveBeenCalled();
      expect(auditService.createAuditLog).not.toHaveBeenCalled();
    });

    it('should handle audit log errors gracefully', (done) => {
      auditService.createAuditLog.mockRejectedValue(new Error('Audit error'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const middleware = auditLogger.auditLogger();

      middleware(mockReq, mockRes, mockNext);
      mockRes.end();

      setImmediate(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to create audit log:',
          expect.any(Error)
        );
        consoleErrorSpy.mockRestore();
        done();
      });
    });
  });

  describe('logLogin', () => {
    it('should log successful login', async () => {
      await auditLogger.logLogin(
        'user-456',
        'user@example.com',
        'tenant-123',
        true,
        '192.168.1.1',
        'Mozilla/5.0',
        mockDb
      );

      expect(auditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          eventType: 'user_login',
          action: 'login',
          userId: 'user-456',
          userEmail: 'user@example.com',
          severity: 'info',
          status: 'success',
        }),
        mockDb
      );
    });

    it('should log failed login', async () => {
      await auditLogger.logLogin(
        null,
        'user@example.com',
        'tenant-123',
        false,
        '192.168.1.1',
        'Mozilla/5.0',
        mockDb
      );

      expect(auditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'login_failed',
          userId: null,
          severity: 'warning',
          status: 'failure',
          errorMessage: 'Invalid credentials',
        }),
        mockDb
      );
    });
  });

  describe('logLogout', () => {
    it('should log logout event', async () => {
      await auditLogger.logLogout(
        'user-456',
        'user@example.com',
        'tenant-123',
        '192.168.1.1',
        'Mozilla/5.0',
        mockDb
      );

      expect(auditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          eventType: 'user_logout',
          action: 'logout',
          userId: 'user-456',
          severity: 'info',
          status: 'success',
        }),
        mockDb
      );
    });
  });

  describe('logDataAccess', () => {
    it('should log data access event', async () => {
      await auditLogger.logDataAccess(
        {
          tenantId: 'tenant-123',
          userId: 'user-456',
          resourceType: 'student',
          resourceId: 'student-789',
        },
        mockDb
      );

      expect(auditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'data_access',
          action: 'read',
          severity: 'info',
          status: 'success',
        }),
        mockDb
      );
    });
  });

  describe('logDataModification', () => {
    it('should log data modification event', async () => {
      await auditLogger.logDataModification(
        {
          tenantId: 'tenant-123',
          userId: 'user-456',
          action: 'update',
          resourceType: 'student',
          resourceId: 'student-789',
          oldValues: { name: 'Old Name' },
          newValues: { name: 'New Name' },
        },
        mockDb
      );

      expect(auditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'data_modification',
          action: 'update',
          severity: 'info',
          status: 'success',
        }),
        mockDb
      );
    });
  });

  describe('logPermissionChange', () => {
    it('should log permission granted', async () => {
      await auditLogger.logPermissionChange(
        {
          tenantId: 'tenant-123',
          userId: 'user-456',
          action: 'grant',
          resourceType: 'role',
          resourceId: 'role-123',
        },
        mockDb
      );

      expect(auditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'permission_granted',
          action: 'grant',
        }),
        mockDb
      );
    });

    it('should log permission revoked', async () => {
      await auditLogger.logPermissionChange(
        {
          tenantId: 'tenant-123',
          userId: 'user-456',
          action: 'revoke',
          resourceType: 'role',
          resourceId: 'role-123',
        },
        mockDb
      );

      expect(auditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'permission_revoked',
          action: 'revoke',
        }),
        mockDb
      );
    });
  });
});
