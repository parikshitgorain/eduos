/**
 * Attendance Routes Tests
 * 
 * Tests for attendance API endpoints.
 */

const request = require('supertest');
const express = require('express');
const attendanceRoutes = require('./attendance');

describe('Attendance Routes', () => {
  let app;
  let mockDb;
  let mockRedis;

  beforeEach(() => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Mock database and Redis
    mockDb = {
      query: jest.fn()
    };

    mockRedis = {
      exists: jest.fn(),
      setex: jest.fn()
    };

    // Add mocks to request
    app.use((req, res, next) => {
      req.db = mockDb;
      req.redis = mockRedis;
      req.tenantId = 'tenant-123';
      next();
    });

    // Mount routes
    app.use('/api/v1/attendance', attendanceRoutes);
  });

  describe('POST /api/v1/attendance/sync', () => {
    it('should sync valid attendance events', async () => {
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

      const response = await request(app)
        .post('/api/v1/attendance/sync')
        .send({ events })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.synced_events).toBe(1);
    });

    it('should return 400 for invalid request body', async () => {
      const response = await request(app)
        .post('/api/v1/attendance/sync')
        .send({ events: 'not-an-array' })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      const events = [
        {
          event_id: 'event-1'
          // Missing other required fields
        }
      ];

      const response = await request(app)
        .post('/api/v1/attendance/sync')
        .send({ events })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 for invalid status value', async () => {
      const events = [
        {
          event_id: 'event-1',
          device_id: 'device-1',
          user_id: 'user-1',
          client_ts: '2026-02-04T09:15:30+05:30',
          data: {
            student_id: 'student-1',
            session_id: 'session-1',
            status: 'invalid-status'
          }
        }
      ];

      const response = await request(app)
        .post('/api/v1/attendance/sync')
        .send({ events })
        .expect(400);

      expect(response.body.status).toBe('error');
    });

    it('should handle multiple events in one request', async () => {
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
        },
        {
          event_id: 'event-2',
          device_id: 'device-1',
          user_id: 'user-1',
          client_ts: '2026-02-04T09:16:00+05:30',
          data: {
            student_id: 'student-2',
            session_id: 'session-1',
            status: 'absent'
          }
        }
      ];

      const response = await request(app)
        .post('/api/v1/attendance/sync')
        .send({ events })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.synced_events).toBe(2);
    });

    it('should handle sync errors gracefully', async () => {
      // Mock validation to pass, but database query to fail
      mockRedis.exists.mockResolvedValue(0);
      mockDb.query.mockRejectedValue(new Error('Database connection failed'));

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

      const response = await request(app)
        .post('/api/v1/attendance/sync')
        .send({ events });

      // The service catches errors and returns them in the details
      expect(response.body.status).toBe('success');
      expect(response.body.errors).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/attendance/session/:sessionId', () => {
    it('should return attendance records for a session', async () => {
      const mockRecords = [
        {
          event_id: 'event-1',
          student_id: 'student-1',
          status: 'present',
          marked_at_utc: '2026-02-04T03:45:30.000Z'
        },
        {
          event_id: 'event-2',
          student_id: 'student-2',
          status: 'absent',
          marked_at_utc: '2026-02-04T03:46:00.000Z'
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockRecords });

      // Use a valid UUID format
      const sessionId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const response = await request(app)
        .get(`/api/v1/attendance/session/${sessionId}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.session_id).toBe(sessionId);
      expect(response.body.count).toBe(2);
      expect(response.body.records).toEqual(mockRecords);
    });

    it('should return 400 for invalid session ID', async () => {
      const response = await request(app)
        .get('/api/v1/attendance/session/invalid-uuid')
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.errors).toBeDefined();
    });

    it('should return empty array for session with no attendance', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/v1/attendance/session/00000000-0000-0000-0000-000000000000')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.count).toBe(0);
      expect(response.body.records).toEqual([]);
    });

    it('should respect Accept-Timezone header', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/v1/attendance/session/00000000-0000-0000-0000-000000000000')
        .set('Accept-Timezone', 'Asia/Kolkata')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.timezone).toBe('Asia/Kolkata');
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/v1/attendance/session/00000000-0000-0000-0000-000000000000')
        .expect(500);

      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/v1/attendance/conflicts', () => {
    it('should return pending conflicts', async () => {
      const mockConflicts = [
        {
          conflict_id: 'conflict-1',
          session_id: 'session-1',
          student_id: 'student-1',
          winning_event_id: 'event-1',
          rejected_event_id: 'event-2',
          resolution_rule: 'earliest_client_timestamp',
          created_at: '2026-02-04T03:45:30.000Z'
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockConflicts });

      const response = await request(app)
        .get('/api/v1/attendance/conflicts')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.count).toBe(1);
      expect(response.body.conflicts).toEqual(mockConflicts);
    });

    it('should respect limit query parameter', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get('/api/v1/attendance/conflicts?limit=10')
        .expect(200);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        ['tenant-123', 10]
      );
    });

    it('should use default limit if not specified', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get('/api/v1/attendance/conflicts')
        .expect(200);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        ['tenant-123', 50]
      );
    });

    it('should return empty array if no conflicts', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/v1/attendance/conflicts')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.count).toBe(0);
      expect(response.body.conflicts).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/attendance/conflicts')
        .expect(500);

      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/v1/attendance/reports/student/:studentId', () => {
    it('should return attendance rate for a student', async () => {
      const mockReport = {
        student_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        total_sessions: 20,
        present: 18,
        absent: 2,
        late: 0,
        attendance_rate: 90.0
      };

      mockDb.query.mockResolvedValue({ rows: [mockReport] });

      const response = await request(app)
        .get('/api/v1/attendance/reports/student/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.report).toBeDefined();
    });

    it('should return 400 for invalid student ID', async () => {
      const response = await request(app)
        .get('/api/v1/attendance/reports/student/invalid-uuid')
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.errors).toBeDefined();
    });

    it('should use custom date range if provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ attendance_rate: 85.0 }] });

      await request(app)
        .get('/api/v1/attendance/reports/student/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
        .query({ startDate: '2026-01-01', endDate: '2026-01-31' })
        .expect(200);

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/attendance/reports/student/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
        .expect(500);

      expect(response.body.status).toBe('error');
    });
  });

  describe('POST /api/v1/attendance/reports/generate', () => {
    it('should generate attendance report with valid parameters', async () => {
      const mockReport = {
        reportType: 'daily',
        data: [{ date: '2026-02-04', present: 50, absent: 5 }]
      };

      mockDb.query.mockResolvedValue({ rows: [mockReport] });

      const response = await request(app)
        .post('/api/v1/attendance/reports/generate')
        .send({
          reportType: 'daily',
          startDate: '2026-02-01T00:00:00Z',
          endDate: '2026-02-07T23:59:59Z'
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.report).toBeDefined();
    });

    it('should return 400 for invalid report type', async () => {
      const response = await request(app)
        .post('/api/v1/attendance/reports/generate')
        .send({
          reportType: 'invalid-type'
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .post('/api/v1/attendance/reports/generate')
        .send({
          reportType: 'daily',
          startDate: 'invalid-date'
        })
        .expect(400);

      expect(response.body.status).toBe('error');
    });

    it('should return 400 for invalid format', async () => {
      const response = await request(app)
        .post('/api/v1/attendance/reports/generate')
        .send({
          reportType: 'daily',
          format: 'xml'
        })
        .expect(400);

      expect(response.body.status).toBe('error');
    });

    it('should generate CSV report when format is csv', async () => {
      const mockReport = {
        data: [{ date: '2026-02-04', present: 50, absent: 5 }]
      };

      mockDb.query.mockResolvedValue({ rows: [mockReport] });

      const response = await request(app)
        .post('/api/v1/attendance/reports/generate')
        .send({
          reportType: 'daily',
          format: 'csv'
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('should handle optional filters', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await request(app)
        .post('/api/v1/attendance/reports/generate')
        .send({
          reportType: 'custom',
          batchId: 'batch-123',
          studentIds: ['student-1', 'student-2']
        })
        .expect(200);

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/v1/attendance/reports/generate')
        .send({
          reportType: 'daily'
        })
        .expect(500);

      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/v1/attendance/reports/daily', () => {
    it('should return daily attendance summary', async () => {
      const mockReport = {
        date: '2026-02-04',
        total_students: 100,
        present: 90,
        absent: 8,
        late: 2
      };

      mockDb.query.mockResolvedValue({ rows: [mockReport] });

      const response = await request(app)
        .get('/api/v1/attendance/reports/daily')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.report).toBeDefined();
    });

    it('should use custom date if provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get('/api/v1/attendance/reports/daily')
        .query({ date: '2026-02-01' })
        .expect(200);

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should filter by batch ID if provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get('/api/v1/attendance/reports/daily')
        .query({ batchId: 'batch-123' })
        .expect(200);

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/attendance/reports/daily')
        .expect(500);

      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/v1/attendance/reports/weekly', () => {
    it('should return weekly attendance summary', async () => {
      const mockReport = {
        week_start: '2026-02-02',
        week_end: '2026-02-08',
        total_students: 100,
        average_attendance: 92.5
      };

      mockDb.query.mockResolvedValue({ rows: [mockReport] });

      const response = await request(app)
        .get('/api/v1/attendance/reports/weekly')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.report).toBeDefined();
    });

    it('should use custom week start if provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get('/api/v1/attendance/reports/weekly')
        .query({ weekStart: '2026-02-01' })
        .expect(200);

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should filter by batch ID if provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get('/api/v1/attendance/reports/weekly')
        .query({ batchId: 'batch-123' })
        .expect(200);

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/attendance/reports/weekly')
        .expect(500);

      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/v1/attendance/reports/monthly', () => {
    it('should return monthly attendance summary', async () => {
      const mockReport = {
        year: 2026,
        month: 2,
        total_students: 100,
        average_attendance: 91.0
      };

      mockDb.query.mockResolvedValue({ rows: [mockReport] });

      const response = await request(app)
        .get('/api/v1/attendance/reports/monthly')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.report).toBeDefined();
    });

    it('should use custom year and month if provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get('/api/v1/attendance/reports/monthly')
        .query({ year: 2025, month: 12 })
        .expect(200);

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should filter by batch ID if provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get('/api/v1/attendance/reports/monthly')
        .query({ batchId: 'batch-123' })
        .expect(200);

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/attendance/reports/monthly')
        .expect(500);

      expect(response.body.status).toBe('error');
    });
  });

  describe('Tenant Isolation', () => {
    it('should require tenant ID for all endpoints', async () => {
      // Create app without tenant ID
      const appNoTenant = express();
      appNoTenant.use(express.json());
      appNoTenant.use((req, res, next) => {
        req.db = mockDb;
        req.redis = mockRedis;
        // No tenantId set
        next();
      });
      appNoTenant.use('/api/v1/attendance', attendanceRoutes);

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

      const response = await request(appNoTenant)
        .post('/api/v1/attendance/sync')
        .send({ events })
        .expect(400);

      expect(response.body.message).toContain('Tenant ID is required');
    });

    it('should require tenant ID for session endpoint', async () => {
      const appNoTenant = express();
      appNoTenant.use(express.json());
      appNoTenant.use((req, res, next) => {
        req.db = mockDb;
        req.redis = mockRedis;
        next();
      });
      appNoTenant.use('/api/v1/attendance', attendanceRoutes);

      const response = await request(appNoTenant)
        .get('/api/v1/attendance/session/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
        .expect(400);

      expect(response.body.message).toContain('Tenant ID is required');
    });

    it('should require tenant ID for conflicts endpoint', async () => {
      const appNoTenant = express();
      appNoTenant.use(express.json());
      appNoTenant.use((req, res, next) => {
        req.db = mockDb;
        req.redis = mockRedis;
        next();
      });
      appNoTenant.use('/api/v1/attendance', attendanceRoutes);

      const response = await request(appNoTenant)
        .get('/api/v1/attendance/conflicts')
        .expect(400);

      expect(response.body.message).toContain('Tenant ID is required');
    });

    it('should require tenant ID for student report endpoint', async () => {
      const appNoTenant = express();
      appNoTenant.use(express.json());
      appNoTenant.use((req, res, next) => {
        req.db = mockDb;
        req.redis = mockRedis;
        next();
      });
      appNoTenant.use('/api/v1/attendance', attendanceRoutes);

      const response = await request(appNoTenant)
        .get('/api/v1/attendance/reports/student/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
        .expect(400);

      expect(response.body.message).toContain('Tenant ID is required');
    });

    it('should require tenant ID for generate report endpoint', async () => {
      const appNoTenant = express();
      appNoTenant.use(express.json());
      appNoTenant.use((req, res, next) => {
        req.db = mockDb;
        req.redis = mockRedis;
        next();
      });
      appNoTenant.use('/api/v1/attendance', attendanceRoutes);

      const response = await request(appNoTenant)
        .post('/api/v1/attendance/reports/generate')
        .send({ reportType: 'daily' })
        .expect(400);

      expect(response.body.message).toContain('Tenant ID is required');
    });

    it('should require tenant ID for daily report endpoint', async () => {
      const appNoTenant = express();
      appNoTenant.use(express.json());
      appNoTenant.use((req, res, next) => {
        req.db = mockDb;
        req.redis = mockRedis;
        next();
      });
      appNoTenant.use('/api/v1/attendance', attendanceRoutes);

      const response = await request(appNoTenant)
        .get('/api/v1/attendance/reports/daily')
        .expect(400);

      expect(response.body.message).toContain('Tenant ID is required');
    });

    it('should require tenant ID for weekly report endpoint', async () => {
      const appNoTenant = express();
      appNoTenant.use(express.json());
      appNoTenant.use((req, res, next) => {
        req.db = mockDb;
        req.redis = mockRedis;
        next();
      });
      appNoTenant.use('/api/v1/attendance', attendanceRoutes);

      const response = await request(appNoTenant)
        .get('/api/v1/attendance/reports/weekly')
        .expect(400);

      expect(response.body.message).toContain('Tenant ID is required');
    });

    it('should require tenant ID for monthly report endpoint', async () => {
      const appNoTenant = express();
      appNoTenant.use(express.json());
      appNoTenant.use((req, res, next) => {
        req.db = mockDb;
        req.redis = mockRedis;
        next();
      });
      appNoTenant.use('/api/v1/attendance', attendanceRoutes);

      const response = await request(appNoTenant)
        .get('/api/v1/attendance/reports/monthly')
        .expect(400);

      expect(response.body.message).toContain('Tenant ID is required');
    });
  });
});
