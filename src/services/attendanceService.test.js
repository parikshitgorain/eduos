/**
 * Attendance Service Tests
 * 
 * Tests for offline-first attendance tracking with sync and conflict resolution.
 */

const AttendanceService = require('./attendanceService');
const crypto = require('crypto');

describe('AttendanceService', () => {
  let attendanceService;
  let mockDb;
  let mockRedis;

  beforeEach(() => {
    // Mock database
    mockDb = {
      query: jest.fn()
    };

    // Mock Redis
    mockRedis = {
      exists: jest.fn(),
      setex: jest.fn()
    };

    attendanceService = new AttendanceService(mockDb, mockRedis);
  });

  describe('generateIdempotencyKey', () => {
    it('should generate consistent SHA-256 hash for same inputs', () => {
      const eventId = 'event-123';
      const deviceId = 'device-456';
      const clientTs = '2026-02-04T09:15:30+05:30';

      const key1 = attendanceService.generateIdempotencyKey(eventId, deviceId, clientTs);
      const key2 = attendanceService.generateIdempotencyKey(eventId, deviceId, clientTs);

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    it('should generate different hashes for different inputs', () => {
      const key1 = attendanceService.generateIdempotencyKey('event-1', 'device-1', '2026-02-04T09:15:30+05:30');
      const key2 = attendanceService.generateIdempotencyKey('event-2', 'device-1', '2026-02-04T09:15:30+05:30');

      expect(key1).not.toBe(key2);
    });
  });

  describe('isEventProcessed', () => {
    it('should return true if event exists in Redis', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await attendanceService.isEventProcessed('test-key');

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith('idempotency:attendance:test-key');
    });

    it('should return false if event does not exist in Redis', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await attendanceService.isEventProcessed('test-key');

      expect(result).toBe(false);
    });
  });

  describe('markEventProcessed', () => {
    it('should store event in Redis with default TTL', async () => {
      await attendanceService.markEventProcessed('test-key');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'idempotency:attendance:test-key',
        86400,
        'processed'
      );
    });

    it('should store event in Redis with custom TTL', async () => {
      await attendanceService.markEventProcessed('test-key', 3600);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'idempotency:attendance:test-key',
        3600,
        'processed'
      );
    });
  });

  describe('validateEvent', () => {
    it('should validate a complete event successfully', () => {
      const event = {
        event_id: 'event-123',
        device_id: 'device-456',
        user_id: 'user-789',
        client_ts: '2026-02-04T09:15:30+05:30',
        data: {
          student_id: 'student-123',
          session_id: 'session-456',
          status: 'present'
        }
      };

      const result = attendanceService.validateEvent(event);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing required fields', () => {
      const event = {
        event_id: 'event-123',
        data: {}
      };

      const result = attendanceService.validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('device_id is required');
      expect(result.errors).toContain('user_id is required');
      expect(result.errors).toContain('client_ts is required');
    });

    it('should return errors for missing data fields', () => {
      const event = {
        event_id: 'event-123',
        device_id: 'device-456',
        user_id: 'user-789',
        client_ts: '2026-02-04T09:15:30+05:30',
        data: {}
      };

      const result = attendanceService.validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('data.student_id is required');
      expect(result.errors).toContain('data.session_id is required');
      expect(result.errors).toContain('data.status is required');
    });

    it('should validate status values', () => {
      const event = {
        event_id: 'event-123',
        device_id: 'device-456',
        user_id: 'user-789',
        client_ts: '2026-02-04T09:15:30+05:30',
        data: {
          student_id: 'student-123',
          session_id: 'session-456',
          status: 'invalid-status'
        }
      };

      const result = attendanceService.validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('data.status must be one of: present, absent, late');
    });
  });

  describe('normalizeTimestamp', () => {
    it('should convert ISO 8601 timestamp to Date object', () => {
      const clientTs = '2026-02-04T09:15:30+05:30';
      const result = attendanceService.normalizeTimestamp(clientTs);

      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2026-02-04T03:45:30.000Z');
    });

    it('should handle UTC timestamps', () => {
      const clientTs = '2026-02-04T09:15:30Z';
      const result = attendanceService.normalizeTimestamp(clientTs);

      expect(result.toISOString()).toBe('2026-02-04T09:15:30.000Z');
    });
  });

  describe('findExistingRecord', () => {
    it('should return existing record if found', async () => {
      const mockRecord = {
        event_id: 'event-123',
        student_id: 'student-123',
        session_id: 'session-456',
        status: 'present',
        marked_at_utc: '2026-02-04T03:45:30.000Z'
      };

      mockDb.query.mockResolvedValue({ rows: [mockRecord] });

      const result = await attendanceService.findExistingRecord(
        'student-123',
        'session-456',
        'tenant-789'
      );

      expect(result).toEqual(mockRecord);
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should return null if no record found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await attendanceService.findExistingRecord(
        'student-123',
        'session-456',
        'tenant-789'
      );

      expect(result).toBeNull();
    });
  });

  describe('resolveConflict', () => {
    it('should choose new event if it has earlier timestamp', () => {
      const existingRecord = {
        event_id: 'event-old',
        marked_at_utc: '2026-02-04T09:16:45.000Z'
      };

      const newEvent = {
        event_id: 'event-new',
        client_ts: '2026-02-04T09:15:30+05:30' // Earlier than existing
      };

      const result = attendanceService.resolveConflict(existingRecord, newEvent);

      expect(result.action).toBe('replace');
      expect(result.winner).toBe('new');
      expect(result.reason).toBe('Earlier client timestamp');
    });

    it('should reject new event if it has later timestamp', () => {
      const existingRecord = {
        event_id: 'event-old',
        marked_at_utc: '2026-02-04T03:45:30.000Z'
      };

      const newEvent = {
        event_id: 'event-new',
        client_ts: '2026-02-04T09:16:45+05:30' // Later than existing
      };

      const result = attendanceService.resolveConflict(existingRecord, newEvent);

      expect(result.action).toBe('reject');
      expect(result.winner).toBe('existing');
      expect(result.reason).toBe('Later client timestamp');
    });
  });

  describe('logConflict', () => {
    it('should insert conflict record into database', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const conflict = {
        sessionId: 'session-123',
        studentId: 'student-456',
        winningEventId: 'event-winner',
        rejectedEventId: 'event-loser',
        details: { reason: 'Earlier timestamp' }
      };

      await attendanceService.logConflict(conflict, 'tenant-789');

      expect(mockDb.query).toHaveBeenCalled();
      const call = mockDb.query.mock.calls[0];
      expect(call[0]).toContain('INSERT INTO sync_conflicts');
      expect(call[1]).toContain('tenant-789');
      expect(call[1]).toContain('session-123');
      expect(call[1]).toContain('student-456');
    });
  });

  describe('storeAttendanceRecord', () => {
    it('should insert attendance record into database', async () => {
      const mockRecord = { event_id: 'event-123' };
      mockDb.query.mockResolvedValue({ rows: [mockRecord] });

      const event = {
        event_id: 'event-123',
        device_id: 'device-456',
        user_id: 'user-789',
        client_ts: '2026-02-04T09:15:30+05:30',
        client_local_time: '2026-02-04T09:15:30+05:30',
        data: {
          student_id: 'student-123',
          session_id: 'session-456',
          batch_id: 'batch-789',
          status: 'present',
          location: {
            latitude: 12.9716,
            longitude: 77.5946,
            accuracy_meters: 10
          }
        }
      };

      const result = await attendanceService.storeAttendanceRecord(event, 'tenant-789');

      expect(result).toEqual(mockRecord);
      expect(mockDb.query).toHaveBeenCalled();
      const call = mockDb.query.mock.calls[0];
      expect(call[0]).toContain('INSERT INTO attendance_records');
    });
  });

  describe('syncOfflineEvents', () => {
    it('should sync valid events successfully', async () => {
      mockRedis.exists.mockResolvedValue(0);
      mockRedis.setex.mockResolvedValue('OK');
      mockDb.query.mockResolvedValue({ rows: [] });

      const events = [
        {
          event_id: 'event-1',
          device_id: 'device-1',
          user_id: 'user-1',
          client_ts: '2026-02-04T09:15:30+05:30',
          data: {
            student_id: 'student-1',
            session_id: 'session-1',
            status: 'present'
          }
        }
      ];

      const result = await attendanceService.syncOfflineEvents(events, 'tenant-1');

      expect(result.synced).toBe(1);
      expect(result.conflicts).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('should skip duplicate events', async () => {
      mockRedis.exists.mockResolvedValue(1); // Event already processed

      const events = [
        {
          event_id: 'event-1',
          device_id: 'device-1',
          user_id: 'user-1',
          client_ts: '2026-02-04T09:15:30+05:30',
          data: {
            student_id: 'student-1',
            session_id: 'session-1',
            status: 'present'
          }
        }
      ];

      const result = await attendanceService.syncOfflineEvents(events, 'tenant-1');

      expect(result.synced).toBe(0);
      expect(result.details[0].status).toBe('duplicate');
    });

    it('should handle validation errors', async () => {
      const events = [
        {
          event_id: 'event-1',
          // Missing required fields
          data: {}
        }
      ];

      const result = await attendanceService.syncOfflineEvents(events, 'tenant-1');

      expect(result.errors).toBe(1);
      expect(result.details[0].status).toBe('error');
      expect(result.details[0].errors).toBeDefined();
    });

    it('should resolve conflicts using earliest timestamp rule', async () => {
      mockRedis.exists.mockResolvedValue(0);
      mockRedis.setex.mockResolvedValue('OK');
      
      // Mock existing record with later timestamp
      const existingRecord = {
        event_id: 'event-old',
        marked_at_utc: '2026-02-04T09:16:45.000Z',
        student_id: 'student-1',
        session_id: 'session-1'
      };
      
      mockDb.query
        .mockResolvedValueOnce({ rows: [existingRecord] }) // findExistingRecord
        .mockResolvedValueOnce({ rows: [{}] }) // updateAttendanceRecord
        .mockResolvedValueOnce({ rows: [] }); // logConflict

      const events = [
        {
          event_id: 'event-new',
          device_id: 'device-1',
          user_id: 'user-1',
          client_ts: '2026-02-04T09:15:30+05:30', // Earlier timestamp
          data: {
            student_id: 'student-1',
            session_id: 'session-1',
            status: 'present'
          }
        }
      ];

      const result = await attendanceService.syncOfflineEvents(events, 'tenant-1');

      expect(result.conflicts).toBe(1);
      expect(result.details[0].status).toBe('conflict_resolved');
      expect(result.details[0].resolution.winner).toBe('new');
    });

    it('should reject new event when existing record has earlier timestamp', async () => {
      mockRedis.exists.mockResolvedValue(0);
      mockRedis.setex.mockResolvedValue('OK');
      
      // Mock existing record with EARLIER timestamp
      const existingRecord = {
        event_id: 'event-old',
        marked_at_utc: '2026-02-04T03:00:00.000Z', // Earlier
        student_id: 'student-1',
        session_id: 'session-1'
      };
      
      mockDb.query
        .mockResolvedValueOnce({ rows: [existingRecord] }) // findExistingRecord
        .mockResolvedValueOnce({ rows: [] }); // logConflict

      const events = [
        {
          event_id: 'event-new',
          device_id: 'device-1',
          user_id: 'user-1',
          client_ts: '2026-02-04T09:15:30+05:30', // Later timestamp
          data: {
            student_id: 'student-1',
            session_id: 'session-1',
            status: 'present'
          }
        }
      ];

      const result = await attendanceService.syncOfflineEvents(events, 'tenant-1');

      expect(result.conflicts).toBe(1);
      expect(result.details[0].status).toBe('conflict_rejected');
      expect(result.details[0].resolution.winner).toBe('existing');
    });
  });

  describe('getSessionAttendance', () => {
    it('should return attendance records for a session', async () => {
      const mockRecords = [
        { event_id: 'event-1', student_id: 'student-1', status: 'present' },
        { event_id: 'event-2', student_id: 'student-2', status: 'absent' }
      ];

      mockDb.query.mockResolvedValue({ rows: mockRecords });

      const result = await attendanceService.getSessionAttendance('session-1', 'tenant-1');

      expect(result).toEqual(mockRecords);
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('getPendingConflicts', () => {
    it('should return pending conflicts for a tenant', async () => {
      const mockConflicts = [
        { conflict_id: 'conflict-1', student_id: 'student-1' },
        { conflict_id: 'conflict-2', student_id: 'student-2' }
      ];

      mockDb.query.mockResolvedValue({ rows: mockConflicts });

      const result = await attendanceService.getPendingConflicts('tenant-1', 50);

      expect(result).toEqual(mockConflicts);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        ['tenant-1', 50]
      );
    });
  });

  describe('validateTimestamp', () => {
    it('should accept timestamps within tolerance', () => {
      const now = new Date();
      const pastTimestamp = new Date(now.getTime() - 60000).toISOString(); // 1 minute ago

      const result = attendanceService.validateTimestamp(pastTimestamp);

      expect(result.valid).toBe(true);
    });

    it('should accept timestamps slightly in the future (within tolerance)', () => {
      const now = new Date();
      const futureTimestamp = new Date(now.getTime() + 60000).toISOString(); // 1 minute ahead

      const result = attendanceService.validateTimestamp(futureTimestamp);

      expect(result.valid).toBe(true);
    });

    it('should reject timestamps far in the future', () => {
      const now = new Date();
      const futureTimestamp = new Date(now.getTime() + 600000).toISOString(); // 10 minutes ahead

      const result = attendanceService.validateTimestamp(futureTimestamp);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Timestamp is in the future');
    });

    it('should use custom tolerance', () => {
      const now = new Date();
      const futureTimestamp = new Date(now.getTime() + 120000).toISOString(); // 2 minutes ahead

      // With 1 minute tolerance - should fail
      const result1 = attendanceService.validateTimestamp(futureTimestamp, 60000);
      expect(result1.valid).toBe(false);

      // With 3 minute tolerance - should pass
      const result2 = attendanceService.validateTimestamp(futureTimestamp, 180000);
      expect(result2.valid).toBe(true);
    });
  });

  describe('convertToClientTimezone', () => {
    it('should convert UTC timestamp to client timezone', () => {
      const utcTimestamp = new Date('2026-02-04T03:45:30.000Z');
      const timezone = 'Asia/Kolkata'; // UTC+5:30

      const result = attendanceService.convertToClientTimezone(utcTimestamp, timezone);

      // Should be 09:15:30 in Asia/Kolkata
      expect(result).toContain('2026-02-04');
      expect(result).toContain('09:15:30');
    });

    it('should return ISO string if no timezone provided', () => {
      const utcTimestamp = new Date('2026-02-04T03:45:30.000Z');

      const result = attendanceService.convertToClientTimezone(utcTimestamp, null);

      expect(result).toBe('2026-02-04T03:45:30.000Z');
    });

    it('should handle invalid timezone gracefully', () => {
      const utcTimestamp = new Date('2026-02-04T03:45:30.000Z');
      const invalidTimezone = 'Invalid/Timezone';

      const result = attendanceService.convertToClientTimezone(utcTimestamp, invalidTimezone);

      // Should fallback to UTC
      expect(result).toBe('2026-02-04T03:45:30.000Z');
    });

    it('should handle different timezones correctly', () => {
      const utcTimestamp = new Date('2026-02-04T12:00:00.000Z');

      // Test multiple timezones
      const resultNY = attendanceService.convertToClientTimezone(utcTimestamp, 'America/New_York');
      const resultTokyo = attendanceService.convertToClientTimezone(utcTimestamp, 'Asia/Tokyo');
      const resultLondon = attendanceService.convertToClientTimezone(utcTimestamp, 'Europe/London');

      expect(resultNY).toContain('2026-02-04');
      expect(resultTokyo).toContain('2026-02-04');
      expect(resultLondon).toContain('2026-02-04');
    });
  });

  describe('getSessionAttendance with timezone', () => {
    it('should return records with client timezone conversion', async () => {
      const mockRecords = [
        {
          event_id: 'event-1',
          student_id: 'student-1',
          marked_at_utc: new Date('2026-02-04T03:45:30.000Z'),
          client_local_time: '2026-02-04T09:15:30+05:30'
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockRecords });

      const result = await attendanceService.getSessionAttendance(
        'session-1',
        'tenant-1',
        'Asia/Kolkata'
      );

      expect(result).toHaveLength(1);
      expect(result[0].marked_at_client).toBeDefined();
      expect(result[0].marked_at_utc).toBe('2026-02-04T03:45:30.000Z');
    });

    it('should return records without timezone conversion if not specified', async () => {
      const mockRecords = [
        {
          event_id: 'event-1',
          student_id: 'student-1',
          marked_at_utc: new Date('2026-02-04T03:45:30.000Z')
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockRecords });

      const result = await attendanceService.getSessionAttendance(
        'session-1',
        'tenant-1',
        null
      );

      expect(result).toHaveLength(1);
      expect(result[0].marked_at_client).toBeUndefined();
    });
  });

  describe('calculateAttendanceRate', () => {
    it('should calculate attendance rate correctly', async () => {
      const mockStats = {
        total_sessions: '10',
        present_count: '7',
        absent_count: '2',
        late_count: '1'
      };

      mockDb.query.mockResolvedValue({ rows: [mockStats] });

      const startDate = new Date('2026-02-01');
      const endDate = new Date('2026-02-07');

      const result = await attendanceService.calculateAttendanceRate(
        'student-1',
        'tenant-1',
        startDate,
        endDate
      );

      expect(result.total_sessions).toBe(10);
      expect(result.present).toBe(7);
      expect(result.absent).toBe(2);
      expect(result.late).toBe(1);
      expect(result.attendance_rate).toBe(80.00); // (7 + 1) / 10 * 100
    });

    it('should handle zero sessions', async () => {
      const mockStats = {
        total_sessions: '0',
        present_count: '0',
        absent_count: '0',
        late_count: '0'
      };

      mockDb.query.mockResolvedValue({ rows: [mockStats] });

      const result = await attendanceService.calculateAttendanceRate(
        'student-1',
        'tenant-1',
        new Date('2026-02-01'),
        new Date('2026-02-07')
      );

      expect(result.attendance_rate).toBe(0);
    });
  });

  describe('generateAttendanceReport', () => {
    it('should generate report with student statistics', async () => {
      const mockRows = [
        {
          student_id: 'student-1',
          total_sessions: '10',
          present_count: '8',
          absent_count: '1',
          late_count: '1',
          first_attendance: new Date('2026-02-01'),
          last_attendance: new Date('2026-02-07')
        },
        {
          student_id: 'student-2',
          total_sessions: '10',
          present_count: '7',
          absent_count: '3',
          late_count: '0',
          first_attendance: new Date('2026-02-01'),
          last_attendance: new Date('2026-02-07')
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockRows });

      const result = await attendanceService.generateAttendanceReport({
        tenantId: 'tenant-1',
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-07'),
        reportType: 'weekly'
      });

      expect(result.report_type).toBe('weekly');
      expect(result.summary.total_students).toBe(2);
      expect(result.students).toHaveLength(2);
      expect(result.students[0].attendance_rate).toBe(90.00); // (8 + 1) / 10 * 100
      expect(result.students[1].attendance_rate).toBe(70.00); // 7 / 10 * 100
      expect(result.summary.average_attendance_rate).toBe(80.00); // (90 + 70) / 2
    });

    it('should apply filters correctly', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await attendanceService.generateAttendanceReport({
        tenantId: 'tenant-1',
        batchId: 'batch-1',
        studentIds: ['student-1', 'student-2'],
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-07')
      });

      expect(mockDb.query).toHaveBeenCalled();
      const queryCall = mockDb.query.mock.calls[0];
      expect(queryCall[0]).toContain('ar.batch_id');
      expect(queryCall[0]).toContain('ar.student_id = ANY');
    });
  });

  describe('exportToCSV', () => {
    it('should export report to CSV format', () => {
      const report = {
        students: [
          {
            student_id: 'student-1',
            total_sessions: 10,
            present: 8,
            absent: 1,
            late: 1,
            attendance_rate: 90.00,
            first_attendance: '2026-02-01T00:00:00.000Z',
            last_attendance: '2026-02-07T23:59:59.000Z'
          }
        ]
      };

      const csv = attendanceService.exportToCSV(report);

      expect(csv).toContain('Student ID,Total Sessions,Present,Absent,Late,Attendance Rate (%)');
      expect(csv).toContain('student-1,10,8,1,1,90');
    });
  });

  describe('getDailyAttendanceSummary', () => {
    it('should generate daily report', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const date = new Date('2026-02-04');
      await attendanceService.getDailyAttendanceSummary('tenant-1', date);

      expect(mockDb.query).toHaveBeenCalled();
      const queryCall = mockDb.query.mock.calls[0];
      expect(queryCall[1]).toContain('tenant-1');
    });
  });

  describe('getWeeklyAttendanceSummary', () => {
    it('should generate weekly report', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const weekStart = new Date('2026-02-03'); // Monday
      await attendanceService.getWeeklyAttendanceSummary('tenant-1', weekStart);

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('getMonthlyAttendanceSummary', () => {
    it('should generate monthly report', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await attendanceService.getMonthlyAttendanceSummary('tenant-1', 2026, 2);

      expect(mockDb.query).toHaveBeenCalled();
    });
  });
});
