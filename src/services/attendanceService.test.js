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
});
