/**
 * Duplicate Review Queue API Routes Tests
 * Task 3.2.4: Build duplicate review queue UI
 */

const request = require('supertest');
const express = require('express');

// Mock database before requiring the route
const mockPool = {
  query: jest.fn()
};

jest.mock('../config/database', () => ({
  getPool: jest.fn(() => mockPool)
}));

const duplicateReviewQueueRoutes = require('./duplicateReviewQueue');

describe('Duplicate Review Queue API Routes', () => {
  let app;
  
  beforeEach(() => {
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/v1/duplicate-review-queue', duplicateReviewQueueRoutes);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('GET /api/v1/duplicate-review-queue', () => {
    it('should return paginated duplicate pairs', async () => {
      const mockPairs = [
        {
          queue_id: 'queue-1',
          primary_student_id: 'student-1',
          candidate_student_id: 'student-2',
          likelihood_score: 0.89,
          deterministic_score: 0.82,
          ai_similarity_score: 0.95,
          first_name_similarity: 0.95,
          last_name_similarity: 0.92,
          dob_match: 1.0,
          reason_codes: ['High name similarity', 'Date of birth exact match'],
          explainability: { method: 'consolidated' },
          status: 'pending_review',
          created_at: '2026-02-07T10:00:00Z',
          reviewed_at: null,
          reviewed_by: null,
          review_notes: null,
          primary_first_name: 'John',
          primary_last_name: 'Doe',
          primary_date_of_birth: '2005-03-15',
          primary_email: 'john@example.com',
          primary_phone: '1234567890',
          primary_created_at: '2026-01-01T00:00:00Z',
          candidate_first_name: 'Jon',
          candidate_last_name: 'Doe',
          candidate_date_of_birth: '2005-03-15',
          candidate_email: 'jon@example.com',
          candidate_phone: '1234567891',
          candidate_created_at: '2026-01-02T00:00:00Z'
        }
      ];
      
      // Mock count query
      mockPool.query.mockResolvedValueOnce({
        rows: [{ count: '1' }]
      });
      
      // Mock data query
      mockPool.query.mockResolvedValueOnce({
        rows: mockPairs
      });
      
      const response = await request(app)
        .get('/api/v1/duplicate-review-queue')
        .query({ tenant_id: 'tenant-1' });
      
      expect(response.status).toBe(200);
      expect(response.body.pairs).toHaveLength(1);
      expect(response.body.pairs[0].queue_id).toBe('queue-1');
      expect(response.body.pairs[0].primary_student.first_name).toBe('John');
      expect(response.body.pairs[0].candidate_student.first_name).toBe('Jon');
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1
      });
    });
    
    it('should filter by status', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      
      const response = await request(app)
        .get('/api/v1/duplicate-review-queue')
        .query({ tenant_id: 'tenant-1', status: 'approved' });
      
      expect(response.status).toBe(200);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND drq.status = $2'),
        expect.arrayContaining(['tenant-1', 'approved'])
      );
    });
    
    it('should return 400 if tenant_id is missing', async () => {
      const response = await request(app)
        .get('/api/v1/duplicate-review-queue');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required parameter: tenant_id');
    });
    
    it('should handle pagination parameters', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '100' }] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      
      const response = await request(app)
        .get('/api/v1/duplicate-review-queue')
        .query({ tenant_id: 'tenant-1', page: 2, limit: 10 });
      
      expect(response.status).toBe(200);
      expect(response.body.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 100,
        total_pages: 10
      });
    });
  });
  
  describe('POST /api/v1/duplicate-review-queue', () => {
    it('should add a duplicate pair to the queue', async () => {
      // Mock existing check
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      
      // Mock insert
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          queue_id: 'queue-1',
          status: 'pending_review',
          created_at: '2026-02-07T10:00:00Z'
        }]
      });
      
      const requestBody = {
        tenant_id: 'tenant-1',
        primary_student_id: 'student-1',
        candidate_student_id: 'student-2',
        likelihood_score: 0.89,
        deterministic_score: 0.82,
        ai_similarity_score: 0.95,
        first_name_similarity: 0.95,
        last_name_similarity: 0.92,
        dob_match: 1.0,
        reason_codes: ['High name similarity'],
        explainability: { method: 'consolidated' }
      };
      
      const response = await request(app)
        .post('/api/v1/duplicate-review-queue')
        .send(requestBody);
      
      expect(response.status).toBe(201);
      expect(response.body.queue_id).toBe('queue-1');
      expect(response.body.status).toBe('pending_review');
    });
    
    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/v1/duplicate-review-queue')
        .send({
          tenant_id: 'tenant-1',
          primary_student_id: 'student-1'
          // Missing candidate_student_id and likelihood_score
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required fields');
    });
    
    it('should return 409 if duplicate pair already exists', async () => {
      // Mock existing pair found
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          queue_id: 'existing-queue-1',
          status: 'pending_review'
        }]
      });
      
      const requestBody = {
        tenant_id: 'tenant-1',
        primary_student_id: 'student-1',
        candidate_student_id: 'student-2',
        likelihood_score: 0.89,
        deterministic_score: 0.82
      };
      
      const response = await request(app)
        .post('/api/v1/duplicate-review-queue')
        .send(requestBody);
      
      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Duplicate pair already exists in queue');
    });
  });
  
  describe('GET /api/v1/duplicate-review-queue/:queue_id', () => {
    it('should return details of a specific duplicate pair', async () => {
      const mockPair = {
        queue_id: 'queue-1',
        primary_student_id: 'student-1',
        candidate_student_id: 'student-2',
        likelihood_score: 0.89,
        deterministic_score: 0.82,
        ai_similarity_score: 0.95,
        first_name_similarity: 0.95,
        last_name_similarity: 0.92,
        dob_match: 1.0,
        reason_codes: ['High name similarity'],
        explainability: { method: 'consolidated' },
        status: 'pending_review',
        created_at: '2026-02-07T10:00:00Z',
        reviewed_at: null,
        reviewed_by: null,
        review_notes: null,
        primary_first_name: 'John',
        primary_last_name: 'Doe',
        primary_date_of_birth: '2005-03-15',
        primary_email: 'john@example.com',
        primary_phone: '1234567890',
        primary_created_at: '2026-01-01T00:00:00Z',
        candidate_first_name: 'Jon',
        candidate_last_name: 'Doe',
        candidate_date_of_birth: '2005-03-15',
        candidate_email: 'jon@example.com',
        candidate_phone: '1234567891',
        candidate_created_at: '2026-01-02T00:00:00Z'
      };
      
      mockPool.query.mockResolvedValueOnce({ rows: [mockPair] });
      
      const response = await request(app)
        .get('/api/v1/duplicate-review-queue/queue-1')
        .query({ tenant_id: 'tenant-1' });
      
      expect(response.status).toBe(200);
      expect(response.body.queue_id).toBe('queue-1');
      expect(response.body.primary_student.first_name).toBe('John');
      expect(response.body.candidate_student.first_name).toBe('Jon');
    });
    
    it('should return 404 if pair not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      
      const response = await request(app)
        .get('/api/v1/duplicate-review-queue/nonexistent')
        .query({ tenant_id: 'tenant-1' });
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Duplicate pair not found');
    });
    
    it('should return 400 if tenant_id is missing', async () => {
      const response = await request(app)
        .get('/api/v1/duplicate-review-queue/queue-1');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required parameter: tenant_id');
    });
  });
  
  describe('PATCH /api/v1/duplicate-review-queue/:queue_id/review', () => {
    it('should approve a duplicate pair for merge', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          queue_id: 'queue-1',
          status: 'approved',
          reviewed_at: '2026-02-07T10:30:00Z'
        }]
      });
      
      const response = await request(app)
        .patch('/api/v1/duplicate-review-queue/queue-1/review')
        .send({
          tenant_id: 'tenant-1',
          decision: 'merge',
          reviewed_by: 'admin-1',
          review_notes: 'Confirmed duplicate'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('approved');
      expect(response.body.decision).toBe('merge');
    });
    
    it('should reject a duplicate pair as not duplicate', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          queue_id: 'queue-1',
          status: 'rejected',
          reviewed_at: '2026-02-07T10:30:00Z'
        }]
      });
      
      const response = await request(app)
        .patch('/api/v1/duplicate-review-queue/queue-1/review')
        .send({
          tenant_id: 'tenant-1',
          decision: 'not_duplicate',
          reviewed_by: 'admin-1'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('rejected');
      expect(response.body.decision).toBe('not_duplicate');
    });
    
    it('should mark pair as need more info', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          queue_id: 'queue-1',
          status: 'need_more_info',
          reviewed_at: '2026-02-07T10:30:00Z'
        }]
      });
      
      const response = await request(app)
        .patch('/api/v1/duplicate-review-queue/queue-1/review')
        .send({
          tenant_id: 'tenant-1',
          decision: 'need_more_info',
          reviewed_by: 'admin-1',
          review_notes: 'Need to verify date of birth'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('need_more_info');
    });
    
    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .patch('/api/v1/duplicate-review-queue/queue-1/review')
        .send({
          tenant_id: 'tenant-1'
          // Missing decision and reviewed_by
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required fields');
    });
    
    it('should return 400 if decision is invalid', async () => {
      const response = await request(app)
        .patch('/api/v1/duplicate-review-queue/queue-1/review')
        .send({
          tenant_id: 'tenant-1',
          decision: 'invalid_decision',
          reviewed_by: 'admin-1'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid decision');
    });
    
    it('should return 404 if pair not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      
      const response = await request(app)
        .patch('/api/v1/duplicate-review-queue/nonexistent/review')
        .send({
          tenant_id: 'tenant-1',
          decision: 'merge',
          reviewed_by: 'admin-1'
        });
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Duplicate pair not found');
    });
  });
  
  describe('GET /api/v1/duplicate-review-queue/stats/summary', () => {
    it('should return queue statistics', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          total: '45',
          pending_review: '30',
          approved: '10',
          rejected: '3',
          need_more_info: '2',
          avg_likelihood_score: '0.84'
        }]
      });
      
      const response = await request(app)
        .get('/api/v1/duplicate-review-queue/stats/summary')
        .query({ tenant_id: 'tenant-1' });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        total: 45,
        pending_review: 30,
        approved: 10,
        rejected: 3,
        need_more_info: 2,
        avg_likelihood_score: '0.84'
      });
    });
    
    it('should return 400 if tenant_id is missing', async () => {
      const response = await request(app)
        .get('/api/v1/duplicate-review-queue/stats/summary');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required parameter: tenant_id');
    });
  });
  
  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Database connection failed'));
      
      const response = await request(app)
        .get('/api/v1/duplicate-review-queue')
        .query({ tenant_id: 'tenant-1' });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });
});
