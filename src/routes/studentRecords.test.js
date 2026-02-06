/**
 * Student Records Routes Tests
 */

const express = require('express');
const request = require('supertest');
const studentRecordsRouter = require('./studentRecords');
const schemaService = require('../services/schemaService');

jest.mock('../services/schemaService');

describe('Student Records Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock user context middleware
    app.use((req, res, next) => {
      req.user = {
        tenant_id: 'tenant-123',
        user_id: 'user-123',
        roles: ['admin']
      };
      next();
    });
    
    app.use('/api/v1/student-records', studentRecordsRouter);
    jest.clearAllMocks();
  });

  describe('GET /api/v1/student-records/:recordId/render', () => {
    it('should render student record with snapshot', async () => {
      const mockRendered = {
        record_id: 'record-1',
        student_id: 'student-1',
        snapshot_id: 'snapshot-1',
        schema_version: '1.0.0',
        integrity_verified: true,
        data: { firstName: 'John', lastName: 'Doe' }
      };

      schemaService.renderRecordWithSnapshot.mockResolvedValue(mockRendered);

      const response = await request(app).get('/api/v1/student-records/record-1/render');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRendered);
    });

    it('should return 404 for non-existent record', async () => {
      schemaService.renderRecordWithSnapshot.mockRejectedValue(new Error('Record not found'));

      const response = await request(app).get('/api/v1/student-records/nonexistent/render');

      expect(response.status).toBe(404);
    });

    it('should return 500 for integrity check failure', async () => {
      schemaService.renderRecordWithSnapshot.mockRejectedValue(
        new Error('Schema integrity check failed')
      );

      const response = await request(app).get('/api/v1/student-records/record-1/render');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('integrity');
    });
  });

  describe('POST /api/v1/student-records/render/batch', () => {
    it('should render multiple records in batch', async () => {
      const mockResults = [
        {
          record_id: 'record-1',
          integrity_verified: true,
          data: {}
        },
        {
          record_id: 'record-2',
          integrity_verified: true,
          data: {}
        }
      ];

      schemaService.renderRecordsWithSnapshots.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/api/v1/student-records/render/batch')
        .send({ record_ids: ['record-1', 'record-2'] });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockResults);
      expect(response.body.summary.total).toBe(2);
      expect(response.body.summary.successful).toBe(2);
    });

    it('should return 400 when record_ids is not an array', async () => {
      const response = await request(app)
        .post('/api/v1/student-records/render/batch')
        .send({ record_ids: 'not-an-array' });

      expect(response.status).toBe(400);
    });

    it('should return 400 when record_ids is missing', async () => {
      const response = await request(app)
        .post('/api/v1/student-records/render/batch')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should handle mixed success/failure results', async () => {
      const mockResults = [
        {
          record_id: 'record-1',
          integrity_verified: true,
          data: {}
        },
        {
          record_id: 'record-2',
          integrity_verified: false,
          data: {}
        }
      ];

      schemaService.renderRecordsWithSnapshots.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/api/v1/student-records/render/batch')
        .send({ record_ids: ['record-1', 'record-2'] });

      expect(response.status).toBe(200);
      expect(response.body.summary.successful).toBe(1);
      expect(response.body.summary.failed).toBe(1);
    });
  });

  describe('GET /api/v1/student-records/student/:studentId/history', () => {
    it('should get student record history', async () => {
      const mockHistory = [
        {
          record_id: 'record-1',
          snapshot_id: 'snapshot-1',
          created_at: '2026-02-05T17:14:48.080Z'
        },
        {
          record_id: 'record-2',
          snapshot_id: 'snapshot-2',
          created_at: '2026-02-05T17:14:48.080Z'
        }
      ];

      schemaService.getStudentRecordHistory.mockResolvedValue(mockHistory);

      const response = await request(app).get('/api/v1/student-records/student/student-1/history');

      expect(response.status).toBe(200);
      expect(response.body.data.student_id).toBe('student-1');
      expect(response.body.data.record_count).toBe(2);
      expect(response.body.data.records).toEqual(mockHistory);
    });

    it('should handle errors', async () => {
      schemaService.getStudentRecordHistory.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/v1/student-records/student/student-1/history');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/v1/student-records', () => {
    it('should create a new student record', async () => {
      const mockRecord = {
        record_id: 'record-1',
        student_id: 'student-1',
        snapshot_id: 'snapshot-1',
        data: { firstName: 'John' }
      };

      schemaService.createStudentRecord.mockResolvedValue(mockRecord);

      const response = await request(app)
        .post('/api/v1/student-records')
        .send({
          student_id: 'student-1',
          snapshot_id: 'snapshot-1',
          data: { firstName: 'John' }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRecord);
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/v1/student-records')
        .send({ student_id: 'student-1' });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent snapshot', async () => {
      schemaService.createStudentRecord.mockRejectedValue(new Error('Snapshot not found'));

      const response = await request(app)
        .post('/api/v1/student-records')
        .send({
          student_id: 'student-1',
          snapshot_id: 'nonexistent',
          data: {}
        });

      expect(response.status).toBe(404);
    });

    it('should return 500 for integrity check failure', async () => {
      schemaService.createStudentRecord.mockRejectedValue(
        new Error('Schema integrity check failed')
      );

      const response = await request(app)
        .post('/api/v1/student-records')
        .send({
          student_id: 'student-1',
          snapshot_id: 'snapshot-1',
          data: {}
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('integrity');
    });

    it('should return 400 for validation errors', async () => {
      schemaService.createStudentRecord.mockRejectedValue(
        new Error('Required field missing: firstName')
      );

      const response = await request(app)
        .post('/api/v1/student-records')
        .send({
          student_id: 'student-1',
          snapshot_id: 'snapshot-1',
          data: {}
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/v1/student-records/:recordId/transform', () => {
    it('should transform record to new schema version', async () => {
      const mockTransformed = {
        new_record_id: 'record-2',
        original_record_id: 'record-1',
        target_snapshot_id: 'snapshot-2',
        transformed_data: {}
      };

      schemaService.transformRecordToNewSchema.mockResolvedValue(mockTransformed);

      const response = await request(app)
        .post('/api/v1/student-records/record-1/transform')
        .send({
          target_snapshot_id: 'snapshot-2',
          field_mappings: { newField: 'oldField' }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTransformed);
      expect(response.body.message).toContain('Original record remains unchanged');
    });

    it('should return 403 for non-admin users', async () => {
      app = express();
      app.use(express.json());
      
      // Mock non-admin user
      app.use((req, res, next) => {
        req.user = {
          tenant_id: 'tenant-123',
          user_id: 'user-123',
          roles: ['teacher']
        };
        next();
      });
      
      app.use('/api/v1/student-records', studentRecordsRouter);

      const response = await request(app)
        .post('/api/v1/student-records/record-1/transform')
        .send({ target_snapshot_id: 'snapshot-2' });

      expect(response.status).toBe(403);
    });

    it('should return 400 when target_snapshot_id is missing', async () => {
      const response = await request(app)
        .post('/api/v1/student-records/record-1/transform')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent record', async () => {
      schemaService.transformRecordToNewSchema.mockRejectedValue(
        new Error('Record not found')
      );

      const response = await request(app)
        .post('/api/v1/student-records/nonexistent/transform')
        .send({ target_snapshot_id: 'snapshot-2' });

      expect(response.status).toBe(404);
    });

    it('should return 500 for integrity check failure', async () => {
      schemaService.transformRecordToNewSchema.mockRejectedValue(
        new Error('Schema integrity check failed')
      );

      const response = await request(app)
        .post('/api/v1/student-records/record-1/transform')
        .send({ target_snapshot_id: 'snapshot-2' });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('integrity');
    });

    it('should return 400 for transformation validation errors', async () => {
      schemaService.transformRecordToNewSchema.mockRejectedValue(
        new Error('Required field missing in transformation')
      );

      const response = await request(app)
        .post('/api/v1/student-records/record-1/transform')
        .send({ target_snapshot_id: 'snapshot-2' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Transformation validation failed');
    });
  });
});
