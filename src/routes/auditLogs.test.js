/**
 * Audit Log Routes Tests
 */

const request = require('supertest');
const express = require('express');
const auditLogsRouter = require('./auditLogs');
const auditService = require('../services/auditService');

// Mock the audit service
jest.mock('../services/auditService');

// Mock pg Pool
jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  const mockPool = {
    connect: jest.fn(() => Promise.resolve(mockClient)),
  };
  return { Pool: jest.fn(() => mockPool) };
});

const { Pool } = require('pg');

describe('Audit Log Routes', () => {
  let app;
  let mockPool;
  let mockClient;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/audit-logs', auditLogsRouter);

    mockPool = new Pool();
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool.connect.mockResolvedValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/audit-logs', () => {
    it('should search audit logs successfully', async () => {
      const now = new Date();
      const mockLogs = [
        {
          id: 'audit-1',
          tenant_id: 'tenant-123',
          event_type: 'user_login',
          action: 'login',
          created_at: now,
        },
        {
          id: 'audit-2',
          tenant_id: 'tenant-123',
          event_type: 'data_modification',
          action: 'update',
          created_at: now,
        },
      ];

      mockClient.query
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({ rows: [{ total: '2' }] }); // COUNT query

      auditService.getAuditLogs.mockResolvedValue(mockLogs);

      const response = await request(app)
        .get('/api/v1/audit-logs')
        .query({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].id).toBe('audit-1');
      expect(response.body.data[1].id).toBe('audit-2');
      expect(response.body.pagination).toHaveProperty('total', 2);
      expect(auditService.getAuditLogs).toHaveBeenCalledWith(
        'tenant-123',
        mockClient,
        {}
      );
    });

    it('should filter audit logs by user_id', async () => {
      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });

      auditService.getAuditLogs.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/audit-logs')
        .query({
          tenant_id: 'tenant-123',
          user_id: 'user-456',
        });

      expect(response.status).toBe(200);
      expect(auditService.getAuditLogs).toHaveBeenCalledWith(
        'tenant-123',
        mockClient,
        { userId: 'user-456' }
      );
    });

    it('should filter audit logs by event_type', async () => {
      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });

      auditService.getAuditLogs.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/audit-logs')
        .query({
          tenant_id: 'tenant-123',
          event_type: 'user_login',
        });

      expect(response.status).toBe(200);
      expect(auditService.getAuditLogs).toHaveBeenCalledWith(
        'tenant-123',
        mockClient,
        { eventType: 'user_login' }
      );
    });

    it('should filter audit logs by action', async () => {
      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });

      auditService.getAuditLogs.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/audit-logs')
        .query({
          tenant_id: 'tenant-123',
          action: 'create',
        });

      expect(response.status).toBe(200);
      expect(auditService.getAuditLogs).toHaveBeenCalledWith(
        'tenant-123',
        mockClient,
        { action: 'create' }
      );
    });

    it('should filter audit logs by date range', async () => {
      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });

      auditService.getAuditLogs.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/audit-logs')
        .query({
          tenant_id: 'tenant-123',
          start_date: '2026-01-01T00:00:00Z',
          end_date: '2026-12-31T23:59:59Z',
        });

      expect(response.status).toBe(200);
      expect(auditService.getAuditLogs).toHaveBeenCalledWith(
        'tenant-123',
        mockClient,
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        })
      );
    });

    it('should handle pagination', async () => {
      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ total: '100' }] });

      auditService.getAuditLogs.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/audit-logs')
        .query({
          tenant_id: 'tenant-123',
          limit: '50',
          offset: '10',
        });

      expect(response.status).toBe(200);
      expect(auditService.getAuditLogs).toHaveBeenCalledWith(
        'tenant-123',
        mockClient,
        { limit: 50, offset: 10 }
      );
    });

    it('should enforce maximum limit', async () => {
      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ total: '100' }] });

      auditService.getAuditLogs.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/audit-logs')
        .query({
          tenant_id: 'tenant-123',
          limit: '5000', // Exceeds max
        });

      expect(response.status).toBe(200);
      expect(auditService.getAuditLogs).toHaveBeenCalledWith(
        'tenant-123',
        mockClient,
        { limit: 1000 } // Capped at 1000
      );
    });

    it('should return 400 if tenant_id is missing', async () => {
      const response = await request(app).get('/api/v1/audit-logs');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required parameter: tenant_id');
    });

    it('should handle errors', async () => {
      mockClient.query.mockResolvedValueOnce({});
      auditService.getAuditLogs.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/audit-logs')
        .query({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to search audit logs');
    });
  });

  describe('GET /api/v1/audit-logs/:id', () => {
    it('should get audit log by ID', async () => {
      const mockLog = {
        id: 'audit-123',
        tenant_id: 'tenant-123',
        event_type: 'user_login',
      };

      mockClient.query.mockResolvedValueOnce({});
      auditService.getAuditLogById.mockResolvedValue(mockLog);

      const response = await request(app)
        .get('/api/v1/audit-logs/audit-123')
        .query({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockLog);
      expect(auditService.getAuditLogById).toHaveBeenCalledWith(
        'audit-123',
        'tenant-123',
        mockClient
      );
    });

    it('should return 404 if audit log not found', async () => {
      mockClient.query.mockResolvedValueOnce({});
      auditService.getAuditLogById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/audit-logs/audit-123')
        .query({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Audit log entry not found');
    });

    it('should return 400 if tenant_id is missing', async () => {
      const response = await request(app).get('/api/v1/audit-logs/audit-123');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required parameter: tenant_id');
    });
  });

  describe('POST /api/v1/audit-logs/export', () => {
    it('should export audit logs with signature', async () => {
      const mockExport = {
        tenant_id: 'tenant-123',
        export_date: '2026-02-07T00:00:00Z',
        total_entries: 100,
        integrity_verified: true,
        logs: [],
        signature: 'abc123def456',
      };

      mockClient.query.mockResolvedValue({});
      auditService.exportAuditLogs.mockResolvedValue(mockExport);
      auditService.createAuditLog.mockResolvedValue('audit-log-id');
      auditService.EVENT_TYPES = { DATA_EXPORT: 'data_export' };
      auditService.ACTIONS = { EXPORT: 'export' };

      const response = await request(app)
        .post('/api/v1/audit-logs/export')
        .send({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.export).toEqual(mockExport);
      expect(auditService.exportAuditLogs).toHaveBeenCalledWith(
        'tenant-123',
        mockClient,
        {}
      );
      expect(auditService.createAuditLog).toHaveBeenCalled();
    });

    it('should export with filters', async () => {
      const mockExport = {
        tenant_id: 'tenant-123',
        total_entries: 10,
        logs: [],
        signature: 'abc123',
      };

      mockClient.query.mockResolvedValue({});
      auditService.exportAuditLogs.mockResolvedValue(mockExport);
      auditService.createAuditLog.mockResolvedValue('audit-log-id');
      auditService.EVENT_TYPES = { DATA_EXPORT: 'data_export' };
      auditService.ACTIONS = { EXPORT: 'export' };

      const response = await request(app)
        .post('/api/v1/audit-logs/export')
        .send({
          tenant_id: 'tenant-123',
          event_type: 'user_login',
          start_date: '2026-01-01T00:00:00Z',
        });

      expect(response.status).toBe(200);
      expect(auditService.exportAuditLogs).toHaveBeenCalledWith(
        'tenant-123',
        mockClient,
        expect.objectContaining({
          eventType: 'user_login',
          startDate: expect.any(Date),
        })
      );
    });

    it('should return 400 if tenant_id is missing', async () => {
      const response = await request(app)
        .post('/api/v1/audit-logs/export')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required field: tenant_id');
    });
  });

  describe('POST /api/v1/audit-logs/verify', () => {
    it('should verify audit integrity', async () => {
      const mockVerification = {
        is_valid: true,
        total_entries: 100,
        invalid_entries: 0,
      };

      mockClient.query.mockResolvedValue({});
      auditService.verifyAuditIntegrity.mockResolvedValue(mockVerification);
      auditService.createAuditLog.mockResolvedValue('audit-log-id');

      const response = await request(app)
        .post('/api/v1/audit-logs/verify')
        .send({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.verification).toEqual(mockVerification);
      expect(auditService.verifyAuditIntegrity).toHaveBeenCalledWith(
        'tenant-123',
        mockClient,
        { startDate: null, endDate: null }
      );
    });

    it('should verify with date range', async () => {
      const mockVerification = {
        is_valid: true,
        total_entries: 50,
        invalid_entries: 0,
      };

      mockClient.query.mockResolvedValue({});
      auditService.verifyAuditIntegrity.mockResolvedValue(mockVerification);
      auditService.createAuditLog.mockResolvedValue('audit-log-id');

      const response = await request(app)
        .post('/api/v1/audit-logs/verify')
        .send({
          tenant_id: 'tenant-123',
          start_date: '2026-01-01T00:00:00Z',
          end_date: '2026-12-31T23:59:59Z',
        });

      expect(response.status).toBe(200);
      expect(auditService.verifyAuditIntegrity).toHaveBeenCalledWith(
        'tenant-123',
        mockClient,
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        })
      );
    });

    it('should return 400 if tenant_id is missing', async () => {
      const response = await request(app)
        .post('/api/v1/audit-logs/verify')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required field: tenant_id');
    });
  });

  describe('GET /api/v1/audit-logs/retention-policy', () => {
    it('should get retention policy', async () => {
      const mockPolicy = {
        id: 'policy-123',
        tenant_id: 'tenant-123',
        retention_days: 36135,
        tier: 'enterprise',
      };

      mockClient.query.mockResolvedValueOnce({});
      auditService.getRetentionPolicy.mockResolvedValue(mockPolicy);

      const response = await request(app)
        .get('/api/v1/audit-logs/retention-policy')
        .query({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.policy).toEqual(mockPolicy);
    });

    it('should return 404 if policy not found', async () => {
      mockClient.query.mockResolvedValueOnce({});
      auditService.getRetentionPolicy.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/audit-logs/retention-policy')
        .query({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Retention policy not found');
    });

    it('should return 400 if tenant_id is missing', async () => {
      const response = await request(app).get(
        '/api/v1/audit-logs/retention-policy'
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required parameter: tenant_id');
    });
  });

  describe('POST /api/v1/audit-logs/retention-policy', () => {
    it('should set retention policy', async () => {
      const mockPolicy = {
        id: 'policy-123',
        tenant_id: 'tenant-123',
        retention_days: 36135,
        tier: 'enterprise',
      };

      mockClient.query.mockResolvedValue({});
      auditService.setRetentionPolicy.mockResolvedValue();
      auditService.getRetentionPolicy.mockResolvedValue(mockPolicy);
      auditService.createAuditLog.mockResolvedValue('audit-log-id');
      auditService.EVENT_TYPES = { SYSTEM_CONFIG_CHANGED: 'system_config_changed' };
      auditService.ACTIONS = { UPDATE: 'update' };

      const response = await request(app)
        .post('/api/v1/audit-logs/retention-policy')
        .send({
          tenant_id: 'tenant-123',
          tier: 'enterprise',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.policy).toEqual(mockPolicy);
      expect(auditService.setRetentionPolicy).toHaveBeenCalledWith(
        'tenant-123',
        'enterprise',
        mockClient
      );
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/v1/audit-logs/retention-policy')
        .send({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required fields');
    });

    it('should return 400 if tier is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/audit-logs/retention-policy')
        .send({
          tenant_id: 'tenant-123',
          tier: 'invalid',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid tier');
    });
  });

  describe('GET /api/v1/audit-logs/event-types', () => {
    it('should get list of event types', async () => {
      auditService.EVENT_TYPES = {
        USER_LOGIN: 'user_login',
        DATA_MODIFICATION: 'data_modification',
      };

      const response = await request(app).get('/api/v1/audit-logs/event-types');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.event_types).toEqual(['user_login', 'data_modification']);
    });
  });

  describe('GET /api/v1/audit-logs/actions', () => {
    it('should get list of actions', async () => {
      auditService.ACTIONS = {
        CREATE: 'create',
        READ: 'read',
        UPDATE: 'update',
      };

      const response = await request(app).get('/api/v1/audit-logs/actions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.actions).toEqual(['create', 'read', 'update']);
    });
  });
});
