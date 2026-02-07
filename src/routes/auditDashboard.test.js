/**
 * Tests for Audit Dashboard Routes
 */

const request = require('supertest');
const express = require('express');
const auditDashboardRoutes = require('./auditDashboard');
const auditDashboardService = require('../services/auditDashboardService');
const auditService = require('../services/auditService');

// Mock the services
jest.mock('../services/auditDashboardService');
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

describe('Audit Dashboard Routes', () => {
  let app;
  let mockClient;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/audit-dashboard', auditDashboardRoutes);

    // Get mock client
    const { Pool } = require('pg');
    const pool = new Pool();
    mockClient = pool.connect();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Role-based access control', () => {
    it('should deny access without proper role', async () => {
      const response = await request(app)
        .get('/api/v1/audit-dashboard/summary')
        .query({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });

    it('should allow access with authorized role', async () => {
      auditDashboardService.getDashboardSummary.mockResolvedValue({
        period_hours: 24,
        total_events: 100,
      });

      const response = await request(app)
        .get('/api/v1/audit-dashboard/summary')
        .set('x-user-role', 'admin')
        .query({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(200);
    });

    it('should allow access for superadmin role', async () => {
      auditDashboardService.getDashboardSummary.mockResolvedValue({
        period_hours: 24,
        total_events: 100,
      });

      const response = await request(app)
        .get('/api/v1/audit-dashboard/summary')
        .set('x-user-role', 'superadmin')
        .query({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(200);
    });

    it('should allow access for auditor role', async () => {
      auditDashboardService.getDashboardSummary.mockResolvedValue({
        period_hours: 24,
        total_events: 100,
      });

      const response = await request(app)
        .get('/api/v1/audit-dashboard/summary')
        .set('x-user-role', 'auditor')
        .query({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(200);
    });

    it('should deny access for unauthorized role', async () => {
      const response = await request(app)
        .get('/api/v1/audit-dashboard/summary')
        .set('x-user-role', 'student')
        .query({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /summary', () => {
    it('should return dashboard summary', async () => {
      const mockSummary = {
        period_hours: 24,
        total_events: 150,
        unique_users: 25,
        failed_logins: 5,
        critical_events: 2,
        suspicious_events: 3,
      };

      auditDashboardService.getDashboardSummary.mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/v1/audit-dashboard/summary')
        .set('x-user-role', 'admin')
        .query({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.summary).toEqual(mockSummary);
    });

    it('should support custom hours parameter', async () => {
      auditDashboardService.getDashboardSummary.mockResolvedValue({
        period_hours: 48,
        total_events: 300,
      });

      const response = await request(app)
        .get('/api/v1/audit-dashboard/summary')
        .set('x-user-role', 'admin')
        .query({ tenant_id: 'tenant-123', hours: '48' });

      expect(response.status).toBe(200);
      expect(auditDashboardService.getDashboardSummary).toHaveBeenCalledWith(
        'tenant-123',
        expect.anything(),
        { hours: 48 }
      );
    });

    it('should return 400 if tenant_id is missing', async () => {
      const response = await request(app)
        .get('/api/v1/audit-dashboard/summary')
        .set('x-user-role', 'admin');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('tenant_id');
    });
  });

  describe('GET /recent-activity', () => {
    it('should return recent activity', async () => {
      const mockActivity = [
        {
          id: 'log-1',
          event_type: 'user_login',
          action: 'login',
          user_email: 'user@example.com',
        },
      ];

      auditDashboardService.getRecentActivity.mockResolvedValue(mockActivity);

      const response = await request(app)
        .get('/api/v1/audit-dashboard/recent-activity')
        .set('x-user-role', 'admin')
        .query({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.activity).toEqual(mockActivity);
    });
  });

  describe('GET /top-users', () => {
    it('should return top users', async () => {
      const mockTopUsers = [
        {
          user_id: 'user-1',
          user_email: 'user1@example.com',
          event_count: 50,
        },
      ];

      auditDashboardService.getTopUsers.mockResolvedValue(mockTopUsers);

      const response = await request(app)
        .get('/api/v1/audit-dashboard/top-users')
        .set('x-user-role', 'admin')
        .query({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.top_users).toEqual(mockTopUsers);
    });
  });

  describe('GET /suspicious-events', () => {
    it('should detect and return suspicious events', async () => {
      const mockSuspiciousEvents = [
        {
          type: 'multiple_failed_logins',
          severity: 'critical',
          description: '10 failed login attempts',
        },
      ];

      auditDashboardService.detectSuspiciousEvents.mockResolvedValue(mockSuspiciousEvents);
      auditService.createAuditLog.mockResolvedValue('log-id');

      const response = await request(app)
        .get('/api/v1/audit-dashboard/suspicious-events')
        .set('x-user-role', 'admin')
        .query({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.suspicious_events).toEqual(mockSuspiciousEvents);
      expect(response.body.total).toBe(1);
      expect(auditService.createAuditLog).toHaveBeenCalled();
    });
  });

  describe('GET /anomalies', () => {
    it('should detect and return anomalies', async () => {
      const mockAnomalies = [
        {
          type: 'after_hours_access',
          severity: 'warning',
          description: 'User accessed system outside business hours',
        },
      ];

      auditDashboardService.detectAnomalies.mockResolvedValue(mockAnomalies);
      auditService.createAuditLog.mockResolvedValue('log-id');

      const response = await request(app)
        .get('/api/v1/audit-dashboard/anomalies')
        .set('x-user-role', 'admin')
        .query({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.anomalies).toEqual(mockAnomalies);
      expect(response.body.total).toBe(1);
    });
  });

  describe('POST /reports/gdpr', () => {
    it('should generate GDPR compliance report', async () => {
      const mockReport = {
        report_type: 'GDPR',
        tenant_id: 'tenant-123',
        data_access: { total_access: 100 },
      };

      auditDashboardService.generateGDPRReport.mockResolvedValue(mockReport);
      auditService.createAuditLog.mockResolvedValue('log-id');

      const response = await request(app)
        .post('/api/v1/audit-dashboard/reports/gdpr')
        .set('x-user-role', 'compliance_officer')
        .send({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.report).toEqual(mockReport);
      expect(auditService.createAuditLog).toHaveBeenCalled();
    });

    it('should support custom date range', async () => {
      const mockReport = {
        report_type: 'GDPR',
        tenant_id: 'tenant-123',
      };

      auditDashboardService.generateGDPRReport.mockResolvedValue(mockReport);
      auditService.createAuditLog.mockResolvedValue('log-id');

      const response = await request(app)
        .post('/api/v1/audit-dashboard/reports/gdpr')
        .set('x-user-role', 'admin')
        .send({
          tenant_id: 'tenant-123',
          start_date: '2026-01-01T00:00:00Z',
          end_date: '2026-12-31T23:59:59Z',
        });

      expect(response.status).toBe(200);
      expect(auditDashboardService.generateGDPRReport).toHaveBeenCalledWith(
        'tenant-123',
        expect.anything(),
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        })
      );
    });
  });

  describe('POST /reports/ferpa', () => {
    it('should generate FERPA compliance report', async () => {
      const mockReport = {
        report_type: 'FERPA',
        tenant_id: 'tenant-123',
        student_record_access: { total_access: 200 },
      };

      auditDashboardService.generateFERPAReport.mockResolvedValue(mockReport);
      auditService.createAuditLog.mockResolvedValue('log-id');

      const response = await request(app)
        .post('/api/v1/audit-dashboard/reports/ferpa')
        .set('x-user-role', 'compliance_officer')
        .send({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.report).toEqual(mockReport);
    });
  });

  describe('POST /alerts/configure', () => {
    it('should configure alert successfully', async () => {
      auditService.createAuditLog.mockResolvedValue('log-id');

      const response = await request(app)
        .post('/api/v1/audit-dashboard/alerts/configure')
        .set('x-user-role', 'admin')
        .send({
          tenant_id: 'tenant-123',
          alert_type: 'failed_logins',
          threshold: 5,
          notification_channels: ['email', 'sms'],
          recipients: ['admin@example.com', '+1234567890'],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.alert_config).toHaveProperty('id');
      expect(response.body.alert_config.alert_type).toBe('failed_logins');
      expect(auditService.createAuditLog).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/audit-dashboard/alerts/configure')
        .set('x-user-role', 'admin')
        .send({
          tenant_id: 'tenant-123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should validate alert type', async () => {
      const response = await request(app)
        .post('/api/v1/audit-dashboard/alerts/configure')
        .set('x-user-role', 'admin')
        .send({
          tenant_id: 'tenant-123',
          alert_type: 'invalid_type',
          threshold: 5,
          notification_channels: ['email'],
          recipients: ['admin@example.com'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid alert type');
    });

    it('should validate notification channels', async () => {
      const response = await request(app)
        .post('/api/v1/audit-dashboard/alerts/configure')
        .set('x-user-role', 'admin')
        .send({
          tenant_id: 'tenant-123',
          alert_type: 'failed_logins',
          threshold: 5,
          notification_channels: ['invalid_channel'],
          recipients: ['admin@example.com'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid notification channels');
    });
  });

  describe('GET /alerts/list', () => {
    it('should return available alert types', async () => {
      const response = await request(app)
        .get('/api/v1/audit-dashboard/alerts/list')
        .set('x-user-role', 'admin')
        .query({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.available_alerts).toBeInstanceOf(Array);
      expect(response.body.available_alerts.length).toBeGreaterThan(0);
      expect(response.body.available_alerts[0]).toHaveProperty('alert_type');
      expect(response.body.available_alerts[0]).toHaveProperty('description');
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      auditDashboardService.getDashboardSummary.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/v1/audit-dashboard/summary')
        .set('x-user-role', 'admin')
        .query({ tenant_id: 'tenant-123' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get dashboard summary');
    });
  });
});
