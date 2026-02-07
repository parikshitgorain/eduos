/**
 * Security Monitoring Service Tests
 * 
 * Task: 4.3.5 - Setup security monitoring and incident response
 */

const {
  SECURITY_EVENT_TYPES,
  ALERT_SEVERITY,
  detectBruteForce,
  detectImpossibleTravel,
  detectPrivilegeEscalation,
  detectBulkDataAccess,
  detectAfterHoursAccess,
  logSecurityEvent,
  triggerSecurityAlert,
  getSecurityEvents,
  getSecurityAlerts,
  updateAlertStatus,
  exportForSIEM,
  generateSecurityMetrics
} = require('./securityMonitoringService');

// Mock database
const mockDb = {
  query: jest.fn()
};

describe('Security Monitoring Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectBruteForce', () => {
    it('should detect brute force attack after threshold exceeded', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'event-123' }] });

      // Simulate 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await detectBruteForce('test@example.com', mockDb, {
          tenantId: 'tenant-123',
          ipAddress: '192.168.1.1'
        });
      }

      const result = await detectBruteForce('test@example.com', mockDb, {
        tenantId: 'tenant-123',
        ipAddress: '192.168.1.1'
      });

      expect(result.detected).toBe(true);
      expect(result.attemptCount).toBeGreaterThanOrEqual(5);
      expect(result.action).toBe('account_locked');
    });

    it('should not detect brute force below threshold', async () => {
      const result = await detectBruteForce('test2@example.com', mockDb, {
        tenantId: 'tenant-123',
        ipAddress: '192.168.1.2'
      });

      expect(result.detected).toBe(false);
      expect(result.attemptCount).toBe(1);
      expect(result.remainingAttempts).toBe(4);
    });
  });

  describe('detectImpossibleTravel', () => {
    it('should detect impossible travel', async () => {
      // Mock last login from different location
      mockDb.query.mockResolvedValue({
        rows: [{
          ip_address: '192.168.1.1',
          location: 'New York',
          created_at: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
        }]
      });

      const result = await detectImpossibleTravel(
        'user-123',
        'London',
        '10.0.0.1',
        mockDb
      );

      expect(result.detected).toBe(true);
      expect(result.previousLocation).toBe('New York');
      expect(result.currentLocation).toBe('London');
    });

    it('should not detect impossible travel for first login', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await detectImpossibleTravel(
        'user-123',
        'New York',
        '192.168.1.1',
        mockDb
      );

      expect(result.detected).toBe(false);
      expect(result.reason).toBe('first_login');
    });

    it('should not detect impossible travel with sufficient time gap', async () => {
      // Mock last login from 5 hours ago
      mockDb.query.mockResolvedValue({
        rows: [{
          ip_address: '192.168.1.1',
          location: 'New York',
          created_at: new Date(Date.now() - 5 * 60 * 60 * 1000)
        }]
      });

      const result = await detectImpossibleTravel(
        'user-123',
        'London',
        '10.0.0.1',
        mockDb
      );

      expect(result.detected).toBe(false);
    });
  });

  describe('detectPrivilegeEscalation', () => {
    it('should detect self-escalation', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'event-123' }] });

      const result = await detectPrivilegeEscalation(
        'user-123',
        'teacher',
        'center_admin',
        'user-123', // Same user
        mockDb
      );

      expect(result.detected).toBe(true);
      expect(result.suspicious).toBe(true);
      expect(result.reason).toBe('self_escalation');
    });

    it('should detect level skipping', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'event-123' }] });

      const result = await detectPrivilegeEscalation(
        'user-123',
        'student',
        'institute_admin', // Skipping levels
        'admin-456',
        mockDb
      );

      expect(result.detected).toBe(true);
      expect(result.suspicious).toBe(true);
      expect(result.reason).toBe('level_skip');
    });

    it('should detect escalation to superadmin', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'event-123' }] });

      const result = await detectPrivilegeEscalation(
        'user-123',
        'admin',
        'superadmin',
        'admin-456',
        mockDb
      );

      expect(result.detected).toBe(true);
      expect(result.suspicious).toBe(true);
    });

    it('should not detect normal escalation', async () => {
      const result = await detectPrivilegeEscalation(
        'user-123',
        'teacher',
        'center_admin', // One level up
        'admin-456',
        mockDb
      );

      expect(result.detected).toBe(false);
    });
  });

  describe('detectBulkDataAccess', () => {
    it('should detect bulk student data access', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'event-123' }] });

      const result = await detectBulkDataAccess(
        'user-123',
        'student',
        150, // Above threshold of 100
        mockDb
      );

      expect(result.detected).toBe(true);
      expect(result.count).toBe(150);
      expect(result.threshold).toBe(100);
      expect(result.action).toBe('flagged_for_review');
    });

    it('should detect bulk payment data access', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'event-123' }] });

      const result = await detectBulkDataAccess(
        'user-123',
        'payment',
        60, // Above threshold of 50
        mockDb
      );

      expect(result.detected).toBe(true);
      expect(result.count).toBe(60);
      expect(result.threshold).toBe(50);
    });

    it('should not detect normal data access', async () => {
      const result = await detectBulkDataAccess(
        'user-123',
        'student',
        50, // Below threshold
        mockDb
      );

      expect(result.detected).toBe(false);
      expect(result.count).toBe(50);
    });
  });

  describe('detectAfterHoursAccess', () => {
    it('should detect after-hours access', async () => {
      // Mock time to be 2 AM
      const originalDate = Date;
      global.Date = class extends Date {
        getHours() {
          return 2;
        }
      };

      mockDb.query.mockResolvedValue({ rows: [{ id: 'event-123' }] });

      const result = await detectAfterHoursAccess(
        'user-123',
        'tenant-123',
        mockDb
      );

      expect(result.detected).toBe(true);
      expect(result.hour).toBe(2);
      expect(result.action).toBe('monitor');

      global.Date = originalDate;
    });

    it('should not detect during business hours', async () => {
      // Mock time to be 2 PM
      const originalDate = Date;
      global.Date = class extends Date {
        getHours() {
          return 14;
        }
      };

      const result = await detectAfterHoursAccess(
        'user-123',
        'tenant-123',
        mockDb
      );

      expect(result.detected).toBe(false);

      global.Date = originalDate;
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security event successfully', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'audit-123' }] }) // createAuditLog
        .mockResolvedValueOnce({ rows: [{ id: 'event-123' }] }); // INSERT security_events

      const eventId = await logSecurityEvent({
        eventType: SECURITY_EVENT_TYPES.BRUTE_FORCE_ATTEMPT,
        severity: ALERT_SEVERITY.HIGH,
        tenantId: 'tenant-123',
        userId: 'user-123',
        attemptCount: 5
      }, mockDb);

      expect(eventId).toBe('event-123');
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('triggerSecurityAlert', () => {
    it('should trigger security alert', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await triggerSecurityAlert({
        type: SECURITY_EVENT_TYPES.BRUTE_FORCE_ATTEMPT,
        severity: ALERT_SEVERITY.HIGH,
        message: 'Brute force attack detected',
        userId: 'user-123',
        tenantId: 'tenant-123',
        context: { attemptCount: 5 }
      }, mockDb);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_alerts'),
        expect.arrayContaining([
          SECURITY_EVENT_TYPES.BRUTE_FORCE_ATTEMPT,
          ALERT_SEVERITY.HIGH,
          'Brute force attack detected'
        ])
      );
    });
  });

  describe('getSecurityEvents', () => {
    it('should retrieve security events for tenant', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          event_type: 'brute_force_attempt',
          severity: 'high',
          detected_at: new Date()
        },
        {
          id: 'event-2',
          event_type: 'privilege_escalation',
          severity: 'critical',
          detected_at: new Date()
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockEvents });

      const events = await getSecurityEvents('tenant-123', mockDb);

      expect(events).toEqual(mockEvents);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM security_events'),
        expect.arrayContaining(['tenant-123'])
      );
    });

    it('should filter events by severity', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await getSecurityEvents('tenant-123', mockDb, {
        severity: ALERT_SEVERITY.CRITICAL
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('severity ='),
        expect.arrayContaining(['tenant-123', ALERT_SEVERITY.CRITICAL])
      );
    });
  });

  describe('getSecurityAlerts', () => {
    it('should retrieve security alerts for tenant', async () => {
      const mockAlerts = [
        {
          id: 'alert-1',
          alert_type: 'brute_force_attempt',
          severity: 'high',
          status: 'open'
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockAlerts });

      const alerts = await getSecurityAlerts('tenant-123', mockDb);

      expect(alerts).toEqual(mockAlerts);
    });

    it('should filter alerts by status', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await getSecurityAlerts('tenant-123', mockDb, {
        status: 'open'
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('status ='),
        expect.arrayContaining(['tenant-123', 'open'])
      );
    });
  });

  describe('updateAlertStatus', () => {
    it('should update alert status', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await updateAlertStatus(
        'alert-123',
        'resolved',
        'admin-456',
        'False positive - legitimate activity',
        mockDb
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE security_alerts'),
        ['resolved', 'admin-456', 'False positive - legitimate activity', 'alert-123']
      );
    });
  });

  describe('exportForSIEM', () => {
    it('should export events in JSON format', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          event_type: 'brute_force_attempt',
          severity: 'high',
          event_data: { attemptCount: 5 }
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockEvents });

      const exported = await exportForSIEM('tenant-123', 'json', mockDb);

      expect(exported).toEqual(mockEvents);
    });

    it('should export events in CEF format', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          event_type: 'brute_force_attempt',
          severity: 'high',
          event_data: { attemptCount: 5 }
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockEvents });

      const exported = await exportForSIEM('tenant-123', 'cef', mockDb);

      expect(exported[0]).toHaveProperty('cef_version');
      expect(exported[0]).toHaveProperty('device_vendor', 'EduOS');
      expect(exported[0]).toHaveProperty('signature_id', 'brute_force_attempt');
    });

    it('should export events in LEEF format', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          event_type: 'brute_force_attempt',
          severity: 'high',
          event_data: { attemptCount: 5 }
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockEvents });

      const exported = await exportForSIEM('tenant-123', 'leef', mockDb);

      expect(exported[0]).toHaveProperty('leef_version', '2.0');
      expect(exported[0]).toHaveProperty('vendor', 'EduOS');
      expect(exported[0]).toHaveProperty('event_id', 'brute_force_attempt');
    });
  });

  describe('generateSecurityMetrics', () => {
    it('should generate security metrics', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{
            total_events: 100,
            critical_events: 5,
            high_events: 15,
            medium_events: 30,
            low_events: 50,
            unique_event_types: 10,
            affected_users: 25
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            total_alerts: 20,
            open_alerts: 5,
            resolved_alerts: 12,
            false_positives: 3,
            avg_resolution_hours: 2.5
          }]
        });

      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      const metrics = await generateSecurityMetrics(
        'tenant-123',
        mockDb,
        startDate,
        endDate
      );

      expect(metrics).toHaveProperty('period');
      expect(metrics.period.start).toEqual(startDate);
      expect(metrics.period.end).toEqual(endDate);
      expect(metrics).toHaveProperty('events');
      expect(metrics.events.total_events).toBe(100);
      expect(metrics).toHaveProperty('alerts');
      expect(metrics.alerts.total_alerts).toBe(20);
    });
  });
});
