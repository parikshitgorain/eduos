/**
 * Enrollment Service Tests
 * 
 * Task: 2.1.3 - Create student enrollment workflow
 */

const enrollmentService = require('./enrollmentService');
const { query, transaction } = require('../config/database');

// Mock the database module
jest.mock('../config/database');

describe('Enrollment Service', () => {
  const mockTenantId = '123e4567-e89b-12d3-a456-426614174000';
  const mockStudentId = '223e4567-e89b-12d3-a456-426614174000';
  const mockBatchId = '323e4567-e89b-12d3-a456-426614174000';
  const mockEnrollmentId = '423e4567-e89b-12d3-a456-426614174000';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('createEnrollment', () => {
    it('should create a new enrollment successfully', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ student_id: mockStudentId }] }) // validateStudent
          .mockResolvedValueOnce({ rows: [{ batch_id: mockBatchId }] }) // validateBatch
          .mockResolvedValueOnce({ rows: [] }) // checkDuplicateEnrollment
          .mockResolvedValueOnce({ // createEnrollment
            rows: [{
              enrollment_id: mockEnrollmentId,
              tenant_id: mockTenantId,
              student_id: mockStudentId,
              batch_id: mockBatchId,
              start_date: '2026-01-01',
              end_date: null,
              status: 'active',
              metadata: {},
              created_at: new Date(),
              updated_at: new Date()
            }]
          })
      };
      
      transaction.mockImplementation(async (callback) => {
        return await callback(mockClient);
      });
      
      const result = await enrollmentService.createEnrollment({
        tenantId: mockTenantId,
        studentId: mockStudentId,
        batchId: mockBatchId,
        startDate: '2026-01-01'
      });
      
      expect(result).toBeDefined();
      expect(result.enrollment_id).toBe(mockEnrollmentId);
      expect(result.status).toBe('active');
      expect(mockClient.query).toHaveBeenCalledTimes(4);
    });
    
    it('should reject enrollment with missing required fields', async () => {
      await expect(
        enrollmentService.createEnrollment({
          tenantId: mockTenantId,
          batchId: mockBatchId,
          startDate: '2026-01-01'
        })
      ).rejects.toThrow('Validation failed: student_id is required');
      
      await expect(
        enrollmentService.createEnrollment({
          tenantId: mockTenantId,
          studentId: mockStudentId,
          startDate: '2026-01-01'
        })
      ).rejects.toThrow('Validation failed: batch_id is required');
      
      await expect(
        enrollmentService.createEnrollment({
          tenantId: mockTenantId,
          studentId: mockStudentId,
          batchId: mockBatchId
        })
      ).rejects.toThrow('Validation failed: start_date is required');
    });
    
    it('should reject enrollment with invalid status', async () => {
      await expect(
        enrollmentService.createEnrollment({
          tenantId: mockTenantId,
          studentId: mockStudentId,
          batchId: mockBatchId,
          startDate: '2026-01-01',
          status: 'invalid_status'
        })
      ).rejects.toThrow('Validation failed: status must be one of');
    });
    
    it('should reject enrollment when start_date is after end_date', async () => {
      await expect(
        enrollmentService.createEnrollment({
          tenantId: mockTenantId,
          studentId: mockStudentId,
          batchId: mockBatchId,
          startDate: '2026-12-31',
          endDate: '2026-01-01'
        })
      ).rejects.toThrow('Validation failed: start_date must be before end_date');
    });
    
    it('should reject duplicate enrollment in same batch', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ student_id: mockStudentId }] }) // validateStudent
          .mockResolvedValueOnce({ rows: [{ batch_id: mockBatchId }] }) // validateBatch
          .mockResolvedValueOnce({ // checkDuplicateEnrollment
            rows: [{
              enrollment_id: mockEnrollmentId,
              status: 'active'
            }]
          })
      };
      
      transaction.mockImplementation(async (callback) => {
        return await callback(mockClient);
      });
      
      await expect(
        enrollmentService.createEnrollment({
          tenantId: mockTenantId,
          studentId: mockStudentId,
          batchId: mockBatchId,
          startDate: '2026-01-01'
        })
      ).rejects.toThrow('Duplicate enrollment detected');
    });
    
    it('should reject enrollment for non-existent student', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // validateStudent - student not found
      };
      
      transaction.mockImplementation(async (callback) => {
        return await callback(mockClient);
      });
      
      await expect(
        enrollmentService.createEnrollment({
          tenantId: mockTenantId,
          studentId: mockStudentId,
          batchId: mockBatchId,
          startDate: '2026-01-01'
        })
      ).rejects.toThrow('Student with ID');
    });
    
    it('should reject enrollment for non-existent batch', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ student_id: mockStudentId }] }) // validateStudent
          .mockResolvedValueOnce({ rows: [] }) // validateBatch - batch not found
      };
      
      transaction.mockImplementation(async (callback) => {
        return await callback(mockClient);
      });
      
      await expect(
        enrollmentService.createEnrollment({
          tenantId: mockTenantId,
          studentId: mockStudentId,
          batchId: mockBatchId,
          startDate: '2026-01-01'
        })
      ).rejects.toThrow('Batch with ID');
    });
  });
  
  describe('getEnrollmentById', () => {
    it('should return enrollment with student and batch details', async () => {
      const mockEnrollment = {
        enrollment_id: mockEnrollmentId,
        tenant_id: mockTenantId,
        student_id: mockStudentId,
        batch_id: mockBatchId,
        start_date: '2026-01-01',
        end_date: null,
        status: 'active',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        batch_name: 'Batch A'
      };
      
      query.mockResolvedValue({ rows: [mockEnrollment] });
      
      const result = await enrollmentService.getEnrollmentById(mockEnrollmentId, mockTenantId);
      
      expect(result).toEqual(mockEnrollment);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [mockEnrollmentId, mockTenantId]
      );
    });
    
    it('should return null for non-existent enrollment', async () => {
      query.mockResolvedValue({ rows: [] });
      
      const result = await enrollmentService.getEnrollmentById(mockEnrollmentId, mockTenantId);
      
      expect(result).toBeNull();
    });
  });
  
  describe('listEnrollments', () => {
    it('should list enrollments with pagination', async () => {
      const mockEnrollments = [
        {
          enrollment_id: mockEnrollmentId,
          tenant_id: mockTenantId,
          student_id: mockStudentId,
          batch_id: mockBatchId,
          status: 'active'
        }
      ];
      
      query
        .mockResolvedValueOnce({ rows: mockEnrollments }) // list query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // count query
      
      const result = await enrollmentService.listEnrollments(mockTenantId, {
        page: 1,
        limit: 20
      });
      
      expect(result.enrollments).toEqual(mockEnrollments);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
      });
    });
    
    it('should filter enrollments by student', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });
      
      await enrollmentService.listEnrollments(mockTenantId, {
        studentId: mockStudentId
      });
      
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('e.student_id = $2'),
        expect.arrayContaining([mockTenantId, mockStudentId])
      );
    });
    
    it('should filter enrollments by batch', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });
      
      await enrollmentService.listEnrollments(mockTenantId, {
        batchId: mockBatchId
      });
      
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('e.batch_id = $2'),
        expect.arrayContaining([mockTenantId, mockBatchId])
      );
    });
    
    it('should filter enrollments by status', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });
      
      await enrollmentService.listEnrollments(mockTenantId, {
        status: 'active'
      });
      
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('e.status = $2'),
        expect.arrayContaining([mockTenantId, 'active'])
      );
    });
  });
  
  describe('updateEnrollmentStatus', () => {
    it('should update enrollment status and preserve history', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ // get current enrollment
            rows: [{
              enrollment_id: mockEnrollmentId,
              status: 'active',
              metadata: {}
            }]
          })
          .mockResolvedValueOnce({ // update enrollment
            rows: [{
              enrollment_id: mockEnrollmentId,
              status: 'graduated',
              metadata: {
                status_history: [{
                  from_status: 'active',
                  to_status: 'graduated',
                  changed_at: expect.any(String)
                }]
              }
            }]
          })
      };
      
      transaction.mockImplementation(async (callback) => {
        return await callback(mockClient);
      });
      
      const result = await enrollmentService.updateEnrollmentStatus(
        mockEnrollmentId,
        mockTenantId,
        'graduated'
      );
      
      expect(result.status).toBe('graduated');
      expect(result.metadata.status_history).toHaveLength(1);
      expect(result.metadata.status_history[0].from_status).toBe('active');
      expect(result.metadata.status_history[0].to_status).toBe('graduated');
    });
    
    it('should reject invalid status', async () => {
      await expect(
        enrollmentService.updateEnrollmentStatus(
          mockEnrollmentId,
          mockTenantId,
          'invalid_status'
        )
      ).rejects.toThrow('Validation failed: status must be one of');
    });
  });
  
  describe('bulkCreateEnrollments', () => {
    it('should create multiple enrollments successfully', async () => {
      const enrollments = [
        {
          studentId: mockStudentId,
          batchId: mockBatchId,
          startDate: '2026-01-01'
        },
        {
          studentId: '333e4567-e89b-12d3-a456-426614174000',
          batchId: mockBatchId,
          startDate: '2026-01-01'
        }
      ];
      
      const mockClient = {
        query: jest.fn()
          // First enrollment
          .mockResolvedValueOnce({ rows: [{ student_id: mockStudentId }] }) // validateStudent
          .mockResolvedValueOnce({ rows: [{ batch_id: mockBatchId }] }) // validateBatch
          .mockResolvedValueOnce({ rows: [] }) // checkDuplicateEnrollment
          .mockResolvedValueOnce({ rows: [{ enrollment_id: mockEnrollmentId }] }) // create
          // Second enrollment
          .mockResolvedValueOnce({ rows: [{ student_id: '333e4567-e89b-12d3-a456-426614174000' }] })
          .mockResolvedValueOnce({ rows: [{ batch_id: mockBatchId }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ enrollment_id: '533e4567-e89b-12d3-a456-426614174000' }] })
      };
      
      transaction.mockImplementation(async (callback) => {
        return await callback(mockClient);
      });
      
      const result = await enrollmentService.bulkCreateEnrollments(mockTenantId, enrollments);
      
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });
    
    it('should handle partial failures in bulk enrollment', async () => {
      const enrollments = [
        {
          studentId: mockStudentId,
          batchId: mockBatchId,
          startDate: '2026-01-01'
        },
        {
          studentId: '333e4567-e89b-12d3-a456-426614174000',
          batchId: mockBatchId,
          startDate: '2026-01-01'
        }
      ];
      
      const mockClient = {
        query: jest.fn()
          // First enrollment - success
          .mockResolvedValueOnce({ rows: [{ student_id: mockStudentId }] })
          .mockResolvedValueOnce({ rows: [{ batch_id: mockBatchId }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ enrollment_id: mockEnrollmentId }] })
          // Second enrollment - student not found
          .mockResolvedValueOnce({ rows: [] })
      };
      
      transaction.mockImplementation(async (callback) => {
        return await callback(mockClient);
      });
      
      const result = await enrollmentService.bulkCreateEnrollments(mockTenantId, enrollments);
      
      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('Student with ID');
    });
    
    it('should reject empty enrollment array', async () => {
      await expect(
        enrollmentService.bulkCreateEnrollments(mockTenantId, [])
      ).rejects.toThrow('Validation failed: enrollments must be a non-empty array');
    });
  });
  
  describe('getStudentEnrollmentHistory', () => {
    it('should return complete enrollment history for a student', async () => {
      const mockHistory = [
        {
          enrollment_id: mockEnrollmentId,
          student_id: mockStudentId,
          batch_name: 'Batch A',
          program_name: 'Program 1',
          center_name: 'Center 1',
          institute_name: 'Institute 1',
          start_date: '2026-01-01',
          status: 'active'
        },
        {
          enrollment_id: '533e4567-e89b-12d3-a456-426614174000',
          student_id: mockStudentId,
          batch_name: 'Batch B',
          program_name: 'Program 2',
          center_name: 'Center 1',
          institute_name: 'Institute 1',
          start_date: '2025-01-01',
          status: 'graduated'
        }
      ];
      
      query.mockResolvedValue({ rows: mockHistory });
      
      const result = await enrollmentService.getStudentEnrollmentHistory(
        mockStudentId,
        mockTenantId
      );
      
      expect(result).toEqual(mockHistory);
      expect(result).toHaveLength(2);
    });
  });
});
