/**
 * Tests for Audit Dashboard Service
 */

const auditDashboardService = require('./auditDashboardService');
const auditService = require('./auditService');

describe('Audit Dashboard Service', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    };
  });

  describe('getDashboardSummary', () => {
    it('should return dashboard summary with key metrics', async () => {
      const tenantId = 'tenant-123';
      
      // Mock database responses for getDashboardSummary
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total_events: '150' }] }) // total events
        .mockResolvedValueOnce({ rows: [{ unique_users: '25' }] }) // unique users
        .mockResolvedValueOnce({ rows: [{ failed_logins: '5' }] }) // failed logins
        .mockResolvedValueOnce({ rows: [{ critical_events: '2' }] }) // critical events
        // Mock database responses for detectSuspiciousEvents
        .mockResolvedValueOnce({ rows: [{ user_email: 'user@example.com', failed_count: '10', ip_addresses: ['192.168.1.1'], first_attempt: new Date(), last_attempt: new Date() }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const summary = await auditDashboardService.getDashboardSummary(tenantId, mockDb);

      expect(summary).toHaveProperty('period_hours', 24);
      expect(summary).toHaveProperty('total_events', 150);
      expect(summary).toHaveProperty('unique_users', 25);
      expect(summary).toHaveProperty('failed_logins', 5);
      expect(summary).toHaveProperty('critical_events', 2);
      expect(summary).toHaveProperty('suspicious_events', 1);
    });

    it('should support custom time period', async () => {
      const tenantId = 'tenant-123';
      
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total_events: '50' }] })
        .mockResolvedValueOnce({ rows: [{ unique_users: '10' }] })
        .mockResolvedValueOnce({ rows: [{ failed_logins: '1' }] })
        .mockResolvedValueOnce({ rows: [{ critical_events: '0' }] })
        // Mock database responses for detectSuspiciousEvents
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const summary = await auditDashboardService.getDashboardSummary(tenantId, mockDb, { hours: 1 });

      expect(summary.period_hours).toBe(1);
    });

    it('should throw error if database client is missing', async () => {
      await expect(
        auditDashboardService.getDashboardSummary('tenant-123', null)
      ).rejects.toThrow('Database client is required');
    });

    it('should throw error if tenant ID is missing', async () => {
      await expect(
        auditDashboardService.getDashboardSummary(null, mockDb)
      ).rejects.toThrow('Tenant ID is required');
    });
  });

  describe('getRecentActivity', () => {
    it('should return recent activity', async () => {
      const tenantId = 'tenant-123';
      const mockActivity = [
        {
          id: 'log-1',
          event_type: 'user_login',
          action: 'login',
          user_email: 'user@example.com',
          created_at: new Date(),
        },
        {
          id: 'log-2',
          event_type: 'data_access',
          action: 'read',
          user_email: 'user@example.com',
          created_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockActivity });

      const activity = await auditDashboardService.getRecentActivity(tenantId, mockDb);

      expect(activity).toEqual(mockActivity);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.arrayContaining([tenantId])
      );
    });

    it('should support custom limit', async () => {
      const tenantId = 'tenant-123';
      mockDb.query.mockResolvedValue({ rows: [] });

      await auditDashboardService.getRecentActivity(tenantId, mockDb, { limit: 100 });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([tenantId, expect.any(Date), 100])
      );
    });
  });

  describe('getTopUsers', () => {
    it('should return top users by activity', async () => {
      const tenantId = 'tenant-123';
      const mockTopUsers = [
        {
          user_id: 'user-1',
          user_email: 'user1@example.com',
          user_role: 'admin',
          event_count: '50',
          unique_event_types: '10',
          last_activity: new Date(),
        },
        {
          user_id: 'user-2',
          user_email: 'user2@example.com',
          user_role: 'teacher',
          event_count: '30',
          unique_event_types: '5',
          last_activity: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockTopUsers });

      const topUsers = await auditDashboardService.getTopUsers(tenantId, mockDb);

      expect(topUsers).toHaveLength(2);
      expect(topUsers[0]).toHaveProperty('event_count', 50);
      expect(topUsers[0]).toHaveProperty('unique_event_types', 10);
    });
  });

  describe('detectSuspiciousEvents', () => {
    it('should detect multiple failed login attempts', async () => {
      const tenantId = 'tenant-123';
      
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              user_email: 'user@example.com',
              failed_count: '10',
              ip_addresses: ['192.168.1.1', '192.168.1.2'],
              first_attempt: new Date(),
              last_attempt: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // bulk ops
        .mockResolvedValueOnce({ rows: [] }) // unusual IPs
        .mockResolvedValueOnce({ rows: [] }); // permission escalation

      const suspiciousEvents = await auditDashboardService.detectSuspiciousEvents(tenantId, mockDb);

      expect(suspiciousEvents).toHaveLength(1);
      expect(suspiciousEvents[0].type).toBe('multiple_failed_logins');
      expect(suspiciousEvents[0].severity).toBe('critical');
    });

    it('should detect bulk operations', async () => {
      const tenantId = 'tenant-123';
      
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // failed logins
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'user-1',
              user_email: 'admin@example.com',
              event_type: 'bulk_deletion',
              action: 'delete',
              operation_count: '5',
              first_operation: new Date(),
              last_operation: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // unusual IPs
        .mockResolvedValueOnce({ rows: [] }); // permission escalation

      const suspiciousEvents = await auditDashboardService.detectSuspiciousEvents(tenantId, mockDb);

      expect(suspiciousEvents).toHaveLength(1);
      expect(suspiciousEvents[0].type).toBe('bulk_operation');
      expect(suspiciousEvents[0].severity).toBe('warning');
    });

    it('should detect permission escalation attempts', async () => {
      const tenantId = 'tenant-123';
      
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // failed logins
        .mockResolvedValueOnce({ rows: [] }) // bulk ops
        .mockResolvedValueOnce({ rows: [] }) // unusual IPs
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'user-1',
              user_email: 'user@example.com',
              escalation_attempts: '5',
              event_types: ['permission_granted', 'role_assigned'],
              first_attempt: new Date(),
              last_attempt: new Date(),
            },
          ],
        });

      const suspiciousEvents = await auditDashboardService.detectSuspiciousEvents(tenantId, mockDb);

      expect(suspiciousEvents).toHaveLength(1);
      expect(suspiciousEvents[0].type).toBe('permission_escalation');
      expect(suspiciousEvents[0].severity).toBe('critical');
    });
  });

  describe('detectAnomalies', () => {
    it('should detect after-hours access', async () => {
      const tenantId = 'tenant-123';
      
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'user-1',
              user_email: 'user@example.com',
              after_hours_count: '10',
              event_types: ['data_access', 'data_modification'],
              first_access: new Date(),
              last_access: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // rapid ops
        .mockResolvedValueOnce({ rows: [] }); // export volume

      const anomalies = await auditDashboardService.detectAnomalies(tenantId, mockDb);

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('after_hours_access');
      expect(anomalies[0].severity).toBe('warning');
    });

    it('should detect rapid operations', async () => {
      const tenantId = 'tenant-123';
      
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // after hours
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'user-1',
              user_email: 'user@example.com',
              rapid_count: '20',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // export volume

      const anomalies = await auditDashboardService.detectAnomalies(tenantId, mockDb);

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('rapid_operations');
    });

    it('should detect unusual export volume', async () => {
      const tenantId = 'tenant-123';
      
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // after hours
        .mockResolvedValueOnce({ rows: [] }) // rapid ops
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'user-1',
              user_email: 'user@example.com',
              export_count: '15',
              resource_types: ['student', 'grade'],
              first_export: new Date(),
              last_export: new Date(),
            },
          ],
        });

      const anomalies = await auditDashboardService.detectAnomalies(tenantId, mockDb);

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('unusual_export_volume');
      expect(anomalies[0].severity).toBe('critical');
    });
  });

  describe('generateGDPRReport', () => {
    it('should generate GDPR compliance report', async () => {
      const tenantId = 'tenant-123';
      
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ total_access: '100', unique_users: '10', unique_resources: '50' }],
        })
        .mockResolvedValueOnce({
          rows: [{ total_modifications: '50', unique_users: '5', unique_resources: '25' }],
        })
        .mockResolvedValueOnce({
          rows: [{ total_deletions: '10', unique_users: '2', unique_resources: '10' }],
        })
        .mockResolvedValueOnce({
          rows: [{ total_exports: '5', unique_users: '3' }],
        })
        .mockResolvedValueOnce({
          rows: [{ consent_changes: '15' }],
        });

      const report = await auditDashboardService.generateGDPRReport(tenantId, mockDb);

      expect(report.report_type).toBe('GDPR');
      expect(report.tenant_id).toBe(tenantId);
      expect(report.data_access.total_access).toBe(100);
      expect(report.data_modifications.total_modifications).toBe(50);
      expect(report.data_deletions.total_deletions).toBe(10);
      expect(report.data_exports.total_exports).toBe(5);
      expect(report.consent_changes).toBe(15);
    });

    it('should support custom date range', async () => {
      const tenantId = 'tenant-123';
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-12-31');
      
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total_access: '0', unique_users: '0', unique_resources: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_modifications: '0', unique_users: '0', unique_resources: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_deletions: '0', unique_users: '0', unique_resources: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_exports: '0', unique_users: '0' }] })
        .mockResolvedValueOnce({ rows: [{ consent_changes: '0' }] });

      const report = await auditDashboardService.generateGDPRReport(tenantId, mockDb, {
        startDate,
        endDate,
      });

      expect(report.period.start_date).toBe(startDate.toISOString());
      expect(report.period.end_date).toBe(endDate.toISOString());
    });
  });

  describe('generateFERPAReport', () => {
    it('should generate FERPA compliance report', async () => {
      const tenantId = 'tenant-123';
      
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ total_access: '200', unique_users: '15', unique_students: '100' }],
        })
        .mockResolvedValueOnce({
          rows: [{ total_modifications: '75', unique_users: '8', unique_students: '50' }],
        })
        .mockResolvedValueOnce({
          rows: [{ total_access: '150', unique_users: '12' }],
        })
        .mockResolvedValueOnce({
          rows: [{ unauthorized_attempts: '5', unique_users: '2' }],
        })
        .mockResolvedValueOnce({
          rows: [{ total_disclosures: '10', unique_users: '3' }],
        });

      const report = await auditDashboardService.generateFERPAReport(tenantId, mockDb);

      expect(report.report_type).toBe('FERPA');
      expect(report.tenant_id).toBe(tenantId);
      expect(report.student_record_access.total_access).toBe(200);
      expect(report.student_record_modifications.total_modifications).toBe(75);
      expect(report.grade_access.total_access).toBe(150);
      expect(report.unauthorized_attempts.total_attempts).toBe(5);
      expect(report.directory_disclosures.total_disclosures).toBe(10);
    });
  });
});
