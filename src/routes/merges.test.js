/**
 * Merge Operations Routes Tests
 * Task: 3.3.3 Create merge audit trail and reversibility
 */

const request = require('supertest');
const express = require('express');
const mergesRouter = require('./merges');
const studentMergeService = require('../services/studentMergeService');

// Mock the service
jest.mock('../services/studentMergeService');

// Create test app
const app = express();
app.use(express.json());

// Mock middleware
app.use((req, res, next) => {
  req.tenantId = 'test-tenant-id';
  req.user = { userId: 'test-user-id' };
  next();
});

app.use('/api/v1/merges', mergesRouter);

describe('Merge Operations Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/merges', () => {
    it('should execute merge successfully', async () => {
      const mockResult = {
        mergeId: 'merge-123',
        snapshotId: 'snapshot-123',
        primaryStudentId: 'student-1',
        secondaryStudentIds: ['student-2'],
        mergedAt: '2026-02-07T10:00:00Z',
        mergedBy: 'test-user-id',
        mergeReason: 'Duplicate entry',
        impact: {
          enrollments: 2,
          attendance: 5,
          payments: 1,
          total: 8
        },
        status: 'completed'
      };

      studentMergeService.executeMerge.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/merges')
        .send({
          primaryStudentId: 'student-1',
          secondaryStudentIds: ['student-2'],
          mergeReason: 'Duplicate entry'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(studentMergeService.executeMerge).toHaveBeenCalledWith({
        tenantId: 'test-tenant-id',
        primaryStudentId: 'student-1',
        secondaryStudentIds: ['student-2'],
        mergeReason: 'Duplicate entry',
        mergedBy: 'test-user-id'
      });
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/merges')
        .send({
          primaryStudentId: 'student-1'
          // Missing secondaryStudentIds and mergeReason
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required fields');
    });

    it('should handle service errors', async () => {
      studentMergeService.executeMerge.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/api/v1/merges')
        .send({
          primaryStudentId: 'student-1',
          secondaryStudentIds: ['student-2'],
          mergeReason: 'Duplicate entry'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to execute merge');
    });
  });

  describe('POST /api/v1/merges/impact-assessment', () => {
    it('should return impact assessment', async () => {
      const mockAssessment = {
        primaryStudentId: 'student-1',
        secondaryStudentIds: ['student-2'],
        affectedRecords: {
          enrollments: 2,
          attendance: 5,
          payments: 1,
          total: 8
        },
        estimatedDuration: '180ms',
        confirmationMessage: 'I understand this will affect 8 records (2 enrollments, 5 attendance records, 1 payment)',
        requiresConfirmation: true
      };

      studentMergeService.getImpactAssessment.mockResolvedValue(mockAssessment);

      const response = await request(app)
        .post('/api/v1/merges/impact-assessment')
        .send({
          primaryStudentId: 'student-1',
          secondaryStudentIds: ['student-2']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAssessment);
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/api/v1/merges/impact-assessment')
        .send({
          primaryStudentId: 'student-1'
          // Missing secondaryStudentIds
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required fields');
    });
  });

  describe('GET /api/v1/merges/:mergeId', () => {
    it('should return merge details', async () => {
      const mockDetails = {
        mergeId: 'merge-123',
        snapshotId: 'snapshot-123',
        primaryStudentId: 'student-1',
        secondaryStudentIds: ['student-2'],
        mergeReason: 'Duplicate entry',
        mergedBy: 'user-123',
        mergedAt: '2026-02-07T10:00:00Z',
        status: 'completed',
        affectedRecords: {
          enrollments: 2,
          attendance: 5,
          payments: 1,
          total: 8
        }
      };

      studentMergeService.getMergeDetails.mockResolvedValue(mockDetails);

      const response = await request(app)
        .get('/api/v1/merges/merge-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockDetails);
    });

    it('should return 404 for non-existent merge', async () => {
      studentMergeService.getMergeDetails.mockRejectedValue(
        new Error('Merge not found')
      );

      const response = await request(app)
        .get('/api/v1/merges/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Failed to retrieve merge details');
    });
  });

  describe('GET /api/v1/merges/student/:studentId/history', () => {
    it('should return merge history for student', async () => {
      const mockHistory = [
        {
          mergeId: 'merge-123',
          snapshotId: 'snapshot-123',
          primaryStudentId: 'student-1',
          secondaryStudentIds: ['student-2'],
          mergeReason: 'Duplicate entry',
          mergedBy: 'user-123',
          mergedAt: '2026-02-07T10:00:00Z',
          status: 'completed',
          affectedRecords: {
            enrollments: 2,
            attendance: 5,
            payments: 1,
            total: 8
          }
        }
      ];

      studentMergeService.getMergeHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/api/v1/merges/student/student-1/history');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.studentId).toBe('student-1');
      expect(response.body.data.merges).toEqual(mockHistory);
    });
  });

  describe('POST /api/v1/merges/:mergeId/restore', () => {
    it('should restore merge successfully', async () => {
      const mockResult = {
        mergeId: 'merge-123',
        status: 'reversed',
        reversedAt: '2026-02-07T12:00:00Z',
        reversedBy: 'test-user-id',
        reverseReason: 'Incorrect merge',
        restoredRecords: {
          primary: 1,
          secondary: 1
        }
      };

      studentMergeService.restoreMerge.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/merges/merge-123/restore')
        .send({
          reverseReason: 'Incorrect merge'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(studentMergeService.restoreMerge).toHaveBeenCalledWith({
        mergeId: 'merge-123',
        tenantId: 'test-tenant-id',
        reversedBy: 'test-user-id',
        reverseReason: 'Incorrect merge'
      });
    });

    it('should return 400 for missing reverseReason', async () => {
      const response = await request(app)
        .post('/api/v1/merges/merge-123/restore')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required field');
    });

    it('should return 404 for non-existent merge', async () => {
      studentMergeService.restoreMerge.mockRejectedValue(
        new Error('Merge not found')
      );

      const response = await request(app)
        .post('/api/v1/merges/merge-123/restore')
        .send({
          reverseReason: 'Incorrect merge'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Failed to restore merge');
    });

    it('should return 403 for expired restore window', async () => {
      studentMergeService.restoreMerge.mockRejectedValue(
        new Error('Restore window expired. Merges can only be restored within 4 hours.')
      );

      const response = await request(app)
        .post('/api/v1/merges/merge-123/restore')
        .send({
          reverseReason: 'Incorrect merge'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Failed to restore merge');
    });

    it('should return 409 for already reversed merge', async () => {
      studentMergeService.restoreMerge.mockRejectedValue(
        new Error('Merge has already been reversed')
      );

      const response = await request(app)
        .post('/api/v1/merges/merge-123/restore')
        .send({
          reverseReason: 'Incorrect merge'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Failed to restore merge');
    });
  });

  describe('GET /api/v1/merges/:mergeId/restore-preview', () => {
    it('should return restore preview', async () => {
      const mockPreview = {
        mergeId: 'merge-123',
        canRestore: true,
        slaWindow: {
          hours: 4,
          timeRemaining: '3.5 hours',
          mergedAt: '2026-02-07T10:00:00Z'
        },
        restoreActions: {
          willRestoreStudents: 1,
          willRevertEnrollments: 2,
          willRevertAttendance: 5,
          willRevertPayments: 1
        },
        primaryStudent: {
          studentId: 'student-1',
          name: 'John Doe'
        },
        secondaryStudents: [
          {
            studentId: 'student-2',
            name: 'Jon Doe'
          }
        ]
      };

      studentMergeService.getRestorePreview.mockResolvedValue(mockPreview);

      const response = await request(app)
        .get('/api/v1/merges/merge-123/restore-preview');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPreview);
    });

    it('should show expired window in preview', async () => {
      const mockPreview = {
        mergeId: 'merge-123',
        canRestore: false,
        slaWindow: {
          hours: 4,
          timeRemaining: 'Expired',
          mergedAt: '2026-02-06T10:00:00Z'
        },
        restoreActions: {
          willRestoreStudents: 1,
          willRevertEnrollments: 2,
          willRevertAttendance: 5,
          willRevertPayments: 1
        },
        primaryStudent: {
          studentId: 'student-1',
          name: 'John Doe'
        },
        secondaryStudents: [
          {
            studentId: 'student-2',
            name: 'Jon Doe'
          }
        ]
      };

      studentMergeService.getRestorePreview.mockResolvedValue(mockPreview);

      const response = await request(app)
        .get('/api/v1/merges/merge-123/restore-preview');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.canRestore).toBe(false);
      expect(response.body.data.slaWindow.timeRemaining).toBe('Expired');
    });

    it('should return 404 for non-existent merge', async () => {
      studentMergeService.getRestorePreview.mockRejectedValue(
        new Error('Merge not found')
      );

      const response = await request(app)
        .get('/api/v1/merges/non-existent/restore-preview');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Failed to generate restore preview');
    });
  });
});
