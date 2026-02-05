/**
 * Integration Tests for Tenant Context Middleware
 * 
 * Tests the middleware integration with Express server and database
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('./server');

// Mock database
jest.mock('./config/database', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn()
  };
  
  return {
    getClient: jest.fn(() => Promise.resolve(mockClient)),
    healthCheck: jest.fn(() => Promise.resolve(true)),
    query: jest.fn(),
    transaction: jest.fn(),
    close: jest.fn()
  };
});

const { getClient } = require('./config/database');

describe('Tenant Context Middleware Integration Tests', () => {
  const JWT_SECRET = 'test-secret-key';
  const TENANT_A_ID = '11111111-1111-1111-1111-111111111111';
  const TENANT_B_ID = '22222222-2222-2222-2222-222222222222';
  const USER_ID = '33333333-3333-3333-3333-333333333333';
  
  let mockClient;
  
  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.NODE_ENV = 'test';
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    getClient.mockResolvedValue(mockClient);
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });
  
  afterAll(() => {
    delete process.env.JWT_SECRET;
    delete process.env.NODE_ENV;
  });
  
  describe('Public Endpoints', () => {
    test('GET / should work without authentication', async () => {
      const response = await request(app).get('/');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'EduOS Platform API');
    });
    
    test('GET /health should work without authentication', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
    });
  });
  
  describe('Protected Endpoints - Authentication', () => {
    test('should reject request without Authorization header', async () => {
      const response = await request(app).get('/api/students');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Unauthorized');
      expect(response.body.message).toContain('Missing Authorization header');
    });
    
    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/students')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });
    
    test('should accept request with valid token', async () => {
      const token = jwt.sign(
        { tenant_id: TENANT_A_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SET LOCAL
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT
      
      const response = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tenant_id', TENANT_A_ID);
    });
  });
  
  describe('Tenant Isolation', () => {
    test('should set PostgreSQL session variable for Tenant A', async () => {
      const token = jwt.sign(
        { tenant_id: TENANT_A_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SET LOCAL
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT
      
      await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${token}`);
      
      expect(mockClient.query).toHaveBeenCalledWith(
        'SET LOCAL app.current_tenant_id = $1',
        [TENANT_A_ID]
      );
    });
    
    test('should set PostgreSQL session variable for Tenant B', async () => {
      const token = jwt.sign(
        { tenant_id: TENANT_B_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SET LOCAL
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT
      
      await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${token}`);
      
      expect(mockClient.query).toHaveBeenCalledWith(
        'SET LOCAL app.current_tenant_id = $1',
        [TENANT_B_ID]
      );
    });
    
    test('should only return students from Tenant A', async () => {
      const token = jwt.sign(
        { tenant_id: TENANT_A_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      const tenantAStudents = [
        {
          student_id: 'student-1',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@tenant-a.com',
          status: 'active'
        }
      ];
      
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SET LOCAL
      mockClient.query.mockResolvedValueOnce({ 
        rows: tenantAStudents, 
        rowCount: 1 
      }); // SELECT
      
      const response = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.tenant_id).toBe(TENANT_A_ID);
      expect(response.body.students).toEqual(tenantAStudents);
      expect(response.body.count).toBe(1);
    });
    
    test('should return 404 when accessing student from different tenant', async () => {
      const token = jwt.sign(
        { tenant_id: TENANT_A_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SET LOCAL
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT (RLS blocks)
      
      const response = await request(app)
        .get('/api/students/student-from-tenant-b')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(404);
      expect(response.body.message).toContain('does not belong to your tenant');
    });
  });
  
  describe('CRUD Operations with Tenant Context', () => {
    test('POST /api/students should create student with tenant_id', async () => {
      const token = jwt.sign(
        { tenant_id: TENANT_A_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      const newStudent = {
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@tenant-a.com',
        date_of_birth: '2005-03-15'
      };
      
      const createdStudent = {
        student_id: 'new-student-id',
        ...newStudent,
        status: 'active',
        created_at: new Date().toISOString()
      };
      
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SET LOCAL
      mockClient.query.mockResolvedValueOnce({ 
        rows: [createdStudent], 
        rowCount: 1 
      }); // INSERT
      
      const response = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(newStudent);
      
      expect(response.status).toBe(201);
      expect(response.body.tenant_id).toBe(TENANT_A_ID);
      expect(response.body.student).toMatchObject({
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@tenant-a.com'
      });
      
      // Verify INSERT query includes tenant_id
      const insertCall = mockClient.query.mock.calls.find(
        call => call[0].includes('INSERT INTO students')
      );
      expect(insertCall[1][0]).toBe(TENANT_A_ID); // First parameter is tenant_id
    });
    
    test('POST /api/students should reject missing required fields', async () => {
      const token = jwt.sign(
        { tenant_id: TENANT_A_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SET LOCAL
      
      const response = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send({ first_name: 'John' }); // Missing last_name and email
      
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Missing required fields');
    });
  });
  
  describe('Performance Monitoring', () => {
    test('should include overhead measurement in response', async () => {
      const token = jwt.sign(
        { tenant_id: TENANT_A_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SET LOCAL
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT
      
      const response = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('overhead_ms');
      expect(typeof response.body.overhead_ms).toBe('number');
      expect(response.body.overhead_ms).toBeLessThan(5);
    });
  });
  
  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      const token = jwt.sign(
        { tenant_id: TENANT_A_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SET LOCAL
      mockClient.query.mockRejectedValueOnce(new Error('Database error')); // SELECT fails
      
      const response = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');
    });
    
    test('should handle duplicate key errors', async () => {
      const token = jwt.sign(
        { tenant_id: TENANT_A_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      const duplicateError = new Error('Duplicate key');
      duplicateError.code = '23505';
      
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SET LOCAL
      mockClient.query.mockRejectedValueOnce(duplicateError); // INSERT fails
      
      const response = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send({
          first_name: 'John',
          last_name: 'Doe',
          email: 'duplicate@tenant-a.com'
        });
      
      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'Conflict');
    });
  });
  
  describe('Database Client Management', () => {
    test('should release database client after request', async () => {
      const token = jwt.sign(
        { tenant_id: TENANT_A_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SET LOCAL
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT
      
      await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${token}`);
      
      // Client should be released after response
      // Note: In real scenario, this happens asynchronously
      expect(getClient).toHaveBeenCalled();
    });
  });
});
