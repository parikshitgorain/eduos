/**
 * Enrollment Routes Integration Tests
 * 
 * Task: 2.1.3 - Create student enrollment workflow
 */

const request = require('supertest');
const express = require('express');
const enrollmentRoutes = require('./enrollments');
const enrollmentService = require('../services/enrollmentService');

// Mock the enrollment service
jest.mock('../services/enrollmentService');

// Create test app
const app = express();
app.use(express.json());

// Mock tenant context middleware
app.use((req, res, next) => {
  req.tenant = { id: '123e4567-e89b-12d3-a456-426614174000' };
  next();
});

app.use('/api/v1/enrollments', enrollmentRoutes);

describe('Enrollment Routes', () => {
  const mockTenantId = '123e4567-e89b-12d3-a456-426614174000';
  const mockStudentId = '223e4567-e89b-12d3-a456-426614174000';
  const mockBatchId = '323e4567-e89b-12d3-a456-426614174000';
  const mockEnrollmentId = '423e4567-e89b-12d3-a456-426614174000';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('POST /api/v1/enrollments', () => {
    it('should create a new enrollment', async () => {
      const mockEnrollment = {
        enrollment_id: mockEnrollmentId,
        tenant_id: mockTenantId,
        student_id: mockStudentId,
        batch_id: mockBatchId,
        start_date: '2026-01-01',
        status: 'active'
      };
      
      enrollmentService.createEnrollment.mockResolvedValue(mockEnrollment);
      
      const response = await request(app)
        .post('/api/v1/enrollments')
        .send({
          studentId: mockStudentId,
          batchId: mockBatchId,
          startDate: '2026-01-01'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.enrollment).toEqual(mockEnrollment);
    });
    
    it('should return 400 for validation errors', async () => {
      enrollmentService.createEnrollment.mockRejectedValue(
        new Error('Validation failed: student_id is required')
      );
      
      const response = await request(app)
        .post('/api/v1/enrollments')
        .send({
          batchId: mockBatchId,
          startDate: '2026-01-01'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation failed');
    });
    
    it('should return 400 for duplicate enrollment', async () => {
      enrollmentService.createEnrollment.mockRejectedValue(
        new Error('Duplicate enrollment detected')
      );
      
      const response = await request(app)
        .post('/api/v1/enrollments')
        .send({
          studentId: mockStudentId,
          batchId: mockBatchId,
          startDate: '2026-01-01'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Duplicate enrollment');
    });
    
    it('should return 404 for non-existent student or batch', async () => {
      enrollmentService.createEnrollment.mockRejectedValue(
        new Error('Student with ID xxx not found')
      );
      
      const response = await request(app)
        .post('/api/v1/enrollments')
        .send({
          studentId: mockStudentId,
          batchId: mockBatchId,
          startDate: '2026-01-01'
        });
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/v1/enrollments/:id', () => {
    it('should return enrollment by ID', async () => {
      const mockEnrollment = {
        enrollment_id: mockEnrollmentId,
        tenant_id: mockTenantId,
        student_id: mockStudentId,
        batch_id: mockBatchId,
        first_name: 'John',
        last_name: 'Doe',
        batch_name: 'Batch A'
      };
      
      enrollmentService.getEnrollmentById.mockResolvedValue(mockEnrollment);
      
      const response = await request(app)
        .get(`/api/v1/enrollments/${mockEnrollmentId}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.enrollment).toEqual(mockEnrollment);
    });
    
    it('should return 404 for non-existent enrollment', async () => {
      enrollmentService.getEnrollmentById.mockResolvedValue(null);
      
      const response = await request(app)
        .get(`/api/v1/enrollments/${mockEnrollmentId}`);
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/v1/enrollments', () => {
    it('should list enrollments with pagination', async () => {
      const mockResult = {
        enrollments: [
          {
            enrollment_id: mockEnrollmentId,
            student_id: mockStudentId,
            batch_id: mockBatchId
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1
        }
      };
      
      enrollmentService.listEnrollments.mockResolvedValue(mockResult);
      
      const response = await request(app)
        .get('/api/v1/enrollments')
        .query({ page: 1, limit: 20 });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.enrollments).toEqual(mockResult.enrollments);
      expect(response.body.pagination).toEqual(mockResult.pagination);
    });
    
    it('should filter enrollments by student', async () => {
      const mockResult = {
        enrollments: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
      };
      
      enrollmentService.listEnrollments.mockResolvedValue(mockResult);
      
      const response = await request(app)
        .get('/api/v1/enrollments')
        .query({ studentId: mockStudentId });
      
      expect(response.status).toBe(200);
      expect(enrollmentService.listEnrollments).toHaveBeenCalledWith(
        mockTenantId,
        expect.objectContaining({ studentId: mockStudentId })
      );
    });
    
    it('should filter enrollments by batch', async () => {
      const mockResult = {
        enrollments: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
      };
      
      enrollmentService.listEnrollments.mockResolvedValue(mockResult);
      
      const response = await request(app)
        .get('/api/v1/enrollments')
        .query({ batchId: mockBatchId });
      
      expect(response.status).toBe(200);
      expect(enrollmentService.listEnrollments).toHaveBeenCalledWith(
        mockTenantId,
        expect.objectContaining({ batchId: mockBatchId })
      );
    });
    
    it('should filter enrollments by status', async () => {
      const mockResult = {
        enrollments: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
      };
      
      enrollmentService.listEnrollments.mockResolvedValue(mockResult);
      
      const response = await request(app)
        .get('/api/v1/enrollments')
        .query({ status: 'active' });
      
      expect(response.status).toBe(200);
      expect(enrollmentService.listEnrollments).toHaveBeenCalledWith(
        mockTenantId,
        expect.objectContaining({ status: 'active' })
      );
    });
  });
  
  describe('PATCH /api/v1/enrollments/:id/status', () => {
    it('should update enrollment status', async () => {
      const mockEnrollment = {
        enrollment_id: mockEnrollmentId,
        status: 'graduated'
      };
      
      enrollmentService.updateEnrollmentStatus.mockResolvedValue(mockEnrollment);
      
      const response = await request(app)
        .patch(`/api/v1/enrollments/${mockEnrollmentId}/status`)
        .send({ status: 'graduated' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.enrollment.status).toBe('graduated');
    });
    
    it('should return 400 when status is missing', async () => {
      const response = await request(app)
        .patch(`/api/v1/enrollments/${mockEnrollmentId}/status`)
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    it('should return 400 for invalid status', async () => {
      enrollmentService.updateEnrollmentStatus.mockRejectedValue(
        new Error('Validation failed: status must be one of')
      );
      
      const response = await request(app)
        .patch(`/api/v1/enrollments/${mockEnrollmentId}/status`)
        .send({ status: 'invalid' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('PATCH /api/v1/enrollments/:id/dates', () => {
    it('should update enrollment dates', async () => {
      const mockEnrollment = {
        enrollment_id: mockEnrollmentId,
        start_date: '2026-01-01',
        end_date: '2026-12-31'
      };
      
      enrollmentService.updateEnrollmentDates.mockResolvedValue(mockEnrollment);
      
      const response = await request(app)
        .patch(`/api/v1/enrollments/${mockEnrollmentId}/dates`)
        .send({
          startDate: '2026-01-01',
          endDate: '2026-12-31'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.enrollment.end_date).toBe('2026-12-31');
    });
    
    it('should return 400 for invalid dates', async () => {
      enrollmentService.updateEnrollmentDates.mockRejectedValue(
        new Error('Validation failed: start_date must be before end_date')
      );
      
      const response = await request(app)
        .patch(`/api/v1/enrollments/${mockEnrollmentId}/dates`)
        .send({
          startDate: '2026-12-31',
          endDate: '2026-01-01'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/v1/enrollments/student/:studentId/history', () => {
    it('should return student enrollment history', async () => {
      const mockHistory = [
        {
          enrollment_id: mockEnrollmentId,
          student_id: mockStudentId,
          batch_name: 'Batch A',
          status: 'active'
        },
        {
          enrollment_id: '533e4567-e89b-12d3-a456-426614174000',
          student_id: mockStudentId,
          batch_name: 'Batch B',
          status: 'graduated'
        }
      ];
      
      enrollmentService.getStudentEnrollmentHistory.mockResolvedValue(mockHistory);
      
      const response = await request(app)
        .get(`/api/v1/enrollments/student/${mockStudentId}/history`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.enrollments).toEqual(mockHistory);
      expect(response.body.count).toBe(2);
    });
  });
  
  describe('POST /api/v1/enrollments/bulk', () => {
    it('should create multiple enrollments', async () => {
      const mockResults = {
        successful: [
          { enrollment: { enrollment_id: mockEnrollmentId } },
          { enrollment: { enrollment_id: '533e4567-e89b-12d3-a456-426614174000' } }
        ],
        failed: []
      };
      
      enrollmentService.bulkCreateEnrollments.mockResolvedValue(mockResults);
      
      const response = await request(app)
        .post('/api/v1/enrollments/bulk')
        .send({
          enrollments: [
            { studentId: mockStudentId, batchId: mockBatchId, startDate: '2026-01-01' },
            { studentId: '333e4567-e89b-12d3-a456-426614174000', batchId: mockBatchId, startDate: '2026-01-01' }
          ]
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.results.successful).toBe(2);
      expect(response.body.results.failed).toBe(0);
    });
    
    it('should return 400 when enrollments is not an array', async () => {
      const response = await request(app)
        .post('/api/v1/enrollments/bulk')
        .send({ enrollments: 'not-an-array' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    it('should handle partial failures', async () => {
      const mockResults = {
        successful: [
          { enrollment: { enrollment_id: mockEnrollmentId } }
        ],
        failed: [
          { enrollment: {}, error: 'Student not found' }
        ]
      };
      
      enrollmentService.bulkCreateEnrollments.mockResolvedValue(mockResults);
      
      const response = await request(app)
        .post('/api/v1/enrollments/bulk')
        .send({
          enrollments: [
            { studentId: mockStudentId, batchId: mockBatchId, startDate: '2026-01-01' },
            { studentId: '333e4567-e89b-12d3-a456-426614174000', batchId: mockBatchId, startDate: '2026-01-01' }
          ]
        });
      
      expect(response.status).toBe(201);
      expect(response.body.results.successful).toBe(1);
      expect(response.body.results.failed).toBe(1);
    });
  });
  
  describe('DELETE /api/v1/enrollments/:id', () => {
    it('should delete (withdraw) enrollment', async () => {
      const mockEnrollment = {
        enrollment_id: mockEnrollmentId,
        status: 'withdrawn'
      };
      
      enrollmentService.deleteEnrollment.mockResolvedValue(mockEnrollment);
      
      const response = await request(app)
        .delete(`/api/v1/enrollments/${mockEnrollmentId}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.enrollment.status).toBe('withdrawn');
    });
    
    it('should return 404 for non-existent enrollment', async () => {
      enrollmentService.deleteEnrollment.mockRejectedValue(
        new Error('Enrollment with ID xxx not found')
      );
      
      const response = await request(app)
        .delete(`/api/v1/enrollments/${mockEnrollmentId}`);
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Additional Coverage Tests', () => {
    it('should handle enrollment with all optional fields', async () => {
      const mockEnrollment = {
        enrollment_id: mockEnrollmentId,
        student_id: mockStudentId,
        batch_id: mockBatchId,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'active',
        metadata: { notes: 'Test enrollment' },
      };
      
      enrollmentService.createEnrollment.mockResolvedValue(mockEnrollment);
      
      const response = await request(app)
        .post('/api/v1/enrollments')
        .send({
          student_id: mockStudentId,
          batch_id: mockBatchId,
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          metadata: { notes: 'Test enrollment' },
        });
      
      expect(response.status).toBe(201);
      expect(response.body.enrollment.metadata).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      enrollmentService.createEnrollment.mockRejectedValue(
        new Error('Database connection failed')
      );
      
      const response = await request(app)
        .post('/api/v1/enrollments')
        .send({
          student_id: mockStudentId,
          batch_id: mockBatchId,
          start_date: '2026-01-01',
        });
      
      expect(response.status).toBe(500);
    });

    it('should list enrollments with all query parameters', async () => {
      enrollmentService.listEnrollments.mockResolvedValue({
        enrollments: [],
        pagination: { page: 2, limit: 10, total: 0, pages: 0 },
      });
      
      const response = await request(app)
        .get('/api/v1/enrollments?page=2&limit=10&status=active&batchId=' + mockBatchId);
      
      expect(response.status).toBe(200);
    });

    it('should handle enrollment updates with partial data', async () => {
      enrollmentService.updateEnrollmentStatus.mockResolvedValue({
        enrollment_id: mockEnrollmentId,
        status: 'completed',
      });
      
      const response = await request(app)
        .patch(`/api/v1/enrollments/${mockEnrollmentId}/status`)
        .send({ status: 'completed' });
      
      expect(response.status).toBe(200);
    });

    it('should handle enrollment deletion errors', async () => {
      enrollmentService.deleteEnrollment.mockRejectedValue(
        new Error('Cannot delete active enrollment')
      );
      
      const response = await request(app)
        .delete(`/api/v1/enrollments/${mockEnrollmentId}`);
      
      expect(response.status).toBe(500);
    });
  });

  // ============================================================================
  // ADDITIONAL TESTS FOR 90%+ COVERAGE
  // ============================================================================

  describe('POST /api/v1/enrollments - Additional Error Scenarios', () => {
    it('should handle internal server errors', async () => {
      enrollmentService.createEnrollment.mockRejectedValue(
        new Error('Unexpected database error')
      );

      const response = await request(app)
        .post('/api/v1/enrollments')
        .send({
          studentId: mockStudentId,
          batchId: mockBatchId
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should handle validation errors with specific messages', async () => {
      enrollmentService.createEnrollment.mockRejectedValue(
        new Error('Validation failed: Invalid date format')
      );

      const response = await request(app)
        .post('/api/v1/enrollments')
        .send({
          studentId: mockStudentId,
          batchId: mockBatchId,
          startDate: 'invalid-date'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Validation failed');
    });

    it('should handle batch not found error', async () => {
      enrollmentService.createEnrollment.mockRejectedValue(
        new Error('Batch not found')
      );

      const response = await request(app)
        .post('/api/v1/enrollments')
        .send({
          studentId: mockStudentId,
          batchId: '00000000-0000-0000-0000-000000000000'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('GET /api/v1/enrollments/:id - Additional Error Scenarios', () => {
    it('should handle internal server errors', async () => {
      enrollmentService.getEnrollmentById.mockRejectedValue(
        new Error('Database query failed')
      );

      const response = await request(app)
        .get(`/api/v1/enrollments/${mockEnrollmentId}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('GET /api/v1/enrollments - Additional Error Scenarios', () => {
    it('should handle internal server errors', async () => {
      enrollmentService.listEnrollments.mockRejectedValue(
        new Error('Database connection lost')
      );

      const response = await request(app)
        .get('/api/v1/enrollments');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should handle pagination with default values', async () => {
      enrollmentService.listEnrollments.mockResolvedValue({
        enrollments: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0
        }
      });

      const response = await request(app)
        .get('/api/v1/enrollments');

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(20);
    });

    it('should handle date range filtering', async () => {
      enrollmentService.listEnrollments.mockResolvedValue({
        enrollments: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0
        }
      });

      const response = await request(app)
        .get('/api/v1/enrollments')
        .query({
          startDateFrom: '2024-01-01',
          startDateTo: '2024-12-31'
        });

      expect(response.status).toBe(200);
      expect(enrollmentService.listEnrollments).toHaveBeenCalledWith(
        mockTenantId,
        expect.objectContaining({
          startDateFrom: '2024-01-01',
          startDateTo: '2024-12-31'
        })
      );
    });
  });

  describe('PATCH /api/v1/enrollments/:id/status - Additional Error Scenarios', () => {
    it('should handle enrollment not found error', async () => {
      enrollmentService.updateEnrollmentStatus.mockRejectedValue(
        new Error('Enrollment not found')
      );

      const response = await request(app)
        .patch(`/api/v1/enrollments/${mockEnrollmentId}/status`)
        .send({ status: 'active' });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should handle internal server errors', async () => {
      enrollmentService.updateEnrollmentStatus.mockRejectedValue(
        new Error('Database update failed')
      );

      const response = await request(app)
        .patch(`/api/v1/enrollments/${mockEnrollmentId}/status`)
        .send({ status: 'active' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should update status with metadata', async () => {
      const mockEnrollment = {
        enrollment_id: mockEnrollmentId,
        status: 'completed',
        metadata: { completionDate: '2024-12-31' }
      };

      enrollmentService.updateEnrollmentStatus.mockResolvedValue(mockEnrollment);

      const response = await request(app)
        .patch(`/api/v1/enrollments/${mockEnrollmentId}/status`)
        .send({
          status: 'completed',
          metadata: { completionDate: '2024-12-31' }
        });

      expect(response.status).toBe(200);
      expect(response.body.enrollment.metadata).toEqual({ completionDate: '2024-12-31' });
    });
  });

  describe('PATCH /api/v1/enrollments/:id/dates - Additional Error Scenarios', () => {
    it('should handle enrollment not found error', async () => {
      enrollmentService.updateEnrollmentDates.mockRejectedValue(
        new Error('Enrollment not found')
      );

      const response = await request(app)
        .patch(`/api/v1/enrollments/${mockEnrollmentId}/dates`)
        .send({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should handle internal server errors', async () => {
      enrollmentService.updateEnrollmentDates.mockRejectedValue(
        new Error('Database update failed')
      );

      const response = await request(app)
        .patch(`/api/v1/enrollments/${mockEnrollmentId}/dates`)
        .send({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should update only start date', async () => {
      const mockEnrollment = {
        enrollment_id: mockEnrollmentId,
        start_date: '2024-02-01',
        end_date: '2024-12-31'
      };

      enrollmentService.updateEnrollmentDates.mockResolvedValue(mockEnrollment);

      const response = await request(app)
        .patch(`/api/v1/enrollments/${mockEnrollmentId}/dates`)
        .send({ startDate: '2024-02-01' });

      expect(response.status).toBe(200);
      expect(response.body.enrollment.start_date).toBe('2024-02-01');
    });

    it('should update only end date', async () => {
      const mockEnrollment = {
        enrollment_id: mockEnrollmentId,
        start_date: '2024-01-01',
        end_date: '2024-11-30'
      };

      enrollmentService.updateEnrollmentDates.mockResolvedValue(mockEnrollment);

      const response = await request(app)
        .patch(`/api/v1/enrollments/${mockEnrollmentId}/dates`)
        .send({ endDate: '2024-11-30' });

      expect(response.status).toBe(200);
      expect(response.body.enrollment.end_date).toBe('2024-11-30');
    });
  });

  describe('GET /api/v1/enrollments/student/:studentId/history - Additional Error Scenarios', () => {
    it('should handle internal server errors', async () => {
      enrollmentService.getStudentEnrollmentHistory.mockRejectedValue(
        new Error('Database query failed')
      );

      const response = await request(app)
        .get(`/api/v1/enrollments/student/${mockStudentId}/history`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should return empty history for student with no enrollments', async () => {
      enrollmentService.getStudentEnrollmentHistory.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/v1/enrollments/student/${mockStudentId}/history`);

      expect(response.status).toBe(200);
      expect(response.body.enrollments).toEqual([]);
      expect(response.body.count).toBe(0);
    });
  });

  describe('POST /api/v1/enrollments/bulk - Additional Error Scenarios', () => {
    it('should handle validation errors', async () => {
      enrollmentService.bulkCreateEnrollments.mockRejectedValue(
        new Error('Validation failed: Invalid enrollment data')
      );

      const response = await request(app)
        .post('/api/v1/enrollments/bulk')
        .send({
          enrollments: [
            { studentId: mockStudentId, batchId: 'invalid' }
          ]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Validation failed');
    });

    it('should handle internal server errors', async () => {
      enrollmentService.bulkCreateEnrollments.mockRejectedValue(
        new Error('Database transaction failed')
      );

      const response = await request(app)
        .post('/api/v1/enrollments/bulk')
        .send({
          enrollments: [
            { studentId: mockStudentId, batchId: mockBatchId }
          ]
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should handle empty enrollments array', async () => {
      enrollmentService.bulkCreateEnrollments.mockResolvedValue({
        successful: [],
        failed: []
      });

      const response = await request(app)
        .post('/api/v1/enrollments/bulk')
        .send({ enrollments: [] });

      expect(response.status).toBe(201);
      expect(response.body.results.total).toBe(0);
    });

    it('should handle null enrollments', async () => {
      const response = await request(app)
        .post('/api/v1/enrollments/bulk')
        .send({ enrollments: null });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('must be an array');
    });

    it('should handle missing enrollments field', async () => {
      const response = await request(app)
        .post('/api/v1/enrollments/bulk')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('must be an array');
    });
  });

  describe('DELETE /api/v1/enrollments/:id - Additional Error Scenarios', () => {
    it('should handle internal server errors', async () => {
      enrollmentService.deleteEnrollment.mockRejectedValue(
        new Error('Database delete failed')
      );

      const response = await request(app)
        .delete(`/api/v1/enrollments/${mockEnrollmentId}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should successfully withdraw enrollment', async () => {
      const mockEnrollment = {
        enrollment_id: mockEnrollmentId,
        status: 'withdrawn',
        withdrawn_at: new Date().toISOString()
      };

      enrollmentService.deleteEnrollment.mockResolvedValue(mockEnrollment);

      const response = await request(app)
        .delete(`/api/v1/enrollments/${mockEnrollmentId}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Enrollment withdrawn successfully');
      expect(response.body.enrollment.status).toBe('withdrawn');
    });
  });
});
