/**
 * Tests for Students API Routes
 * Task 3.2.1: Build deterministic fuzzy matching layer
 */

const request = require('supertest');
const express = require('express');
const studentsRouter = require('./students');
const duplicateDetectionService = require('../services/duplicateDetectionService');

// Mock the duplicate detection service
jest.mock('../services/duplicateDetectionService');

describe('Students API Routes', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/students', studentsRouter);
    jest.clearAllMocks();
  });
  
  describe('POST /api/v1/students/check-duplicates', () => {
    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/students/check-duplicates')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required fields');
      expect(response.body.required).toEqual(['first_name', 'last_name', 'tenant_id']);
    });
    
    it('should return empty duplicates array when no matches found', async () => {
      duplicateDetectionService.checkDuplicates.mockResolvedValue([]);
      
      const response = await request(app)
        .post('/api/v1/students/check-duplicates')
        .send({
          first_name: 'John',
          last_name: 'Doe',
          date_of_birth: '2005-03-15',
          tenant_id: 'tenant-uuid'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.duplicates).toEqual([]);
      expect(response.body.has_duplicates).toBe(false);
      expect(response.body.count).toBe(0);
    });
    
    it('should return duplicate candidates when matches found', async () => {
      const mockDuplicates = [
        {
          candidate_student_id: 'duplicate-uuid',
          candidate_first_name: 'John',
          candidate_last_name: 'Doe',
          candidate_date_of_birth: '2005-03-15',
          likelihood_score: 1.0,
          deterministic_score: 1.0,
          first_name_similarity: 1.0,
          last_name_similarity: 1.0,
          dob_match: 1.0,
          reason_codes: ['High first name similarity (100%)', 'High last name similarity (100%)', 'Date of birth exact match'],
          status: 'pending_review'
        }
      ];
      
      duplicateDetectionService.checkDuplicates.mockResolvedValue(mockDuplicates);
      
      const response = await request(app)
        .post('/api/v1/students/check-duplicates')
        .send({
          first_name: 'John',
          last_name: 'Doe',
          date_of_birth: '2005-03-15',
          tenant_id: 'tenant-uuid'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.duplicates).toEqual(mockDuplicates);
      expect(response.body.has_duplicates).toBe(true);
      expect(response.body.count).toBe(1);
    });
    
    it('should pass student_id when provided (for updates)', async () => {
      duplicateDetectionService.checkDuplicates.mockResolvedValue([]);
      
      await request(app)
        .post('/api/v1/students/check-duplicates')
        .send({
          first_name: 'John',
          last_name: 'Doe',
          date_of_birth: '2005-03-15',
          tenant_id: 'tenant-uuid',
          student_id: 'current-student-uuid'
        });
      
      expect(duplicateDetectionService.checkDuplicates).toHaveBeenCalledWith({
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-03-15',
        tenant_id: 'tenant-uuid',
        student_id: 'current-student-uuid'
      });
    });
    
    it('should handle service errors gracefully', async () => {
      duplicateDetectionService.checkDuplicates.mockRejectedValue(
        new Error('Database connection failed')
      );
      
      const response = await request(app)
        .post('/api/v1/students/check-duplicates')
        .send({
          first_name: 'John',
          last_name: 'Doe',
          tenant_id: 'tenant-uuid'
        });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
      expect(response.body.message).toBe('Database connection failed');
    });
    
    it('should work without date_of_birth', async () => {
      duplicateDetectionService.checkDuplicates.mockResolvedValue([]);
      
      const response = await request(app)
        .post('/api/v1/students/check-duplicates')
        .send({
          first_name: 'John',
          last_name: 'Doe',
          tenant_id: 'tenant-uuid'
        });
      
      expect(response.status).toBe(200);
      expect(duplicateDetectionService.checkDuplicates).toHaveBeenCalledWith({
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: undefined,
        tenant_id: 'tenant-uuid',
        student_id: undefined
      });
    });
  });
  
  describe('POST /api/v1/students/batch-check-duplicates', () => {
    it('should return 400 for missing students array', async () => {
      const response = await request(app)
        .post('/api/v1/students/batch-check-duplicates')
        .send({ tenant_id: 'tenant-uuid' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing or invalid students array');
    });
    
    it('should return 400 for empty students array', async () => {
      const response = await request(app)
        .post('/api/v1/students/batch-check-duplicates')
        .send({
          students: [],
          tenant_id: 'tenant-uuid'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing or invalid students array');
    });
    
    it('should return 400 for missing tenant_id', async () => {
      const response = await request(app)
        .post('/api/v1/students/batch-check-duplicates')
        .send({
          students: [{ first_name: 'John', last_name: 'Doe' }]
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required field: tenant_id');
    });
    
    it('should process batch duplicate check successfully', async () => {
      const mockResults = [
        {
          input_student: { first_name: 'John', last_name: 'Doe' },
          duplicates: [],
          has_duplicates: false
        },
        {
          input_student: { first_name: 'Jane', last_name: 'Smith' },
          duplicates: [
            {
              candidate_student_id: 'duplicate-uuid',
              likelihood_score: 0.95
            }
          ],
          has_duplicates: true
        }
      ];
      
      duplicateDetectionService.batchCheckDuplicates.mockResolvedValue(mockResults);
      
      const response = await request(app)
        .post('/api/v1/students/batch-check-duplicates')
        .send({
          students: [
            { first_name: 'John', last_name: 'Doe', date_of_birth: '2005-03-15' },
            { first_name: 'Jane', last_name: 'Smith', date_of_birth: '2006-01-01' }
          ],
          tenant_id: 'tenant-uuid'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.results).toEqual(mockResults);
      expect(response.body.total_checked).toBe(2);
      expect(response.body.total_with_duplicates).toBe(1);
    });
    
    it('should call batchCheckDuplicates with correct parameters', async () => {
      duplicateDetectionService.batchCheckDuplicates.mockResolvedValue([]);
      
      const students = [
        { first_name: 'John', last_name: 'Doe', date_of_birth: '2005-03-15' },
        { first_name: 'Jane', last_name: 'Smith', date_of_birth: '2006-01-01' }
      ];
      
      await request(app)
        .post('/api/v1/students/batch-check-duplicates')
        .send({
          students,
          tenant_id: 'tenant-uuid'
        });
      
      expect(duplicateDetectionService.batchCheckDuplicates).toHaveBeenCalledWith(
        students,
        'tenant-uuid'
      );
    });
    
    it('should handle service errors gracefully', async () => {
      duplicateDetectionService.batchCheckDuplicates.mockRejectedValue(
        new Error('Database connection failed')
      );
      
      const response = await request(app)
        .post('/api/v1/students/batch-check-duplicates')
        .send({
          students: [{ first_name: 'John', last_name: 'Doe' }],
          tenant_id: 'tenant-uuid'
        });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
      expect(response.body.message).toBe('Database connection failed');
    });
    
    it('should count duplicates correctly', async () => {
      const mockResults = [
        { input_student: {}, duplicates: [], has_duplicates: false },
        { input_student: {}, duplicates: [{}], has_duplicates: true },
        { input_student: {}, duplicates: [{}], has_duplicates: true },
        { input_student: {}, duplicates: [], has_duplicates: false }
      ];
      
      duplicateDetectionService.batchCheckDuplicates.mockResolvedValue(mockResults);
      
      const response = await request(app)
        .post('/api/v1/students/batch-check-duplicates')
        .send({
          students: [{}, {}, {}, {}],
          tenant_id: 'tenant-uuid'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.total_checked).toBe(4);
      expect(response.body.total_with_duplicates).toBe(2);
    });
  });
  
  describe('API Performance', () => {
    it('should respond within acceptable time for single check', async () => {
      duplicateDetectionService.checkDuplicates.mockResolvedValue([]);
      
      const startTime = Date.now();
      
      await request(app)
        .post('/api/v1/students/check-duplicates')
        .send({
          first_name: 'John',
          last_name: 'Doe',
          tenant_id: 'tenant-uuid'
        });
      
      const duration = Date.now() - startTime;
      
      // API should respond quickly (< 100ms for mocked service)
      expect(duration).toBeLessThan(100);
    });
  });
});
