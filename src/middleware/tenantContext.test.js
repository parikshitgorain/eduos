/**
 * Tenant Context Middleware Tests
 * 
 * Comprehensive test suite covering:
 * - JWT token extraction and validation
 * - Tenant context setting
 * - Cross-tenant access prevention
 * - Performance benchmarks
 * - Error handling
 */

const jwt = require('jsonwebtoken');

// Mock database BEFORE importing middleware
const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

jest.mock('../config/database', () => ({
  getClient: jest.fn(() => Promise.resolve(mockClient))
}));

const { tenantContext, validateTenantAccess, crossTenantGuard } = require('./tenantContext');
const { getClient } = require('../config/database');

describe('Tenant Context Middleware', () => {
  let req, res, next;
  const JWT_SECRET = 'test-secret-key';
  const TENANT_ID = '11111111-1111-1111-1111-111111111111';
  const USER_ID = '22222222-2222-2222-2222-222222222222';
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Set JWT secret
    process.env.JWT_SECRET = JWT_SECRET;
    
    // Mock request object
    req = {
      headers: {},
      path: '/api/students'
    };
    
    // Mock response object
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      on: jest.fn()
    };
    
    // Mock next function
    next = jest.fn();
    
    // Mock database query success
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });
  
  afterEach(() => {
    delete process.env.JWT_SECRET;
  });
  
  describe('JWT Token Extraction', () => {
    test('should reject request without Authorization header', async () => {
      await tenantContext(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Missing Authorization header'
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should reject request with invalid Authorization header format', async () => {
      req.headers.authorization = 'InvalidFormat token123';
      
      await tenantContext(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid Authorization header format. Expected: Bearer <token>'
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should reject request with expired token', async () => {
      const expiredToken = jwt.sign(
        { tenant_id: TENANT_ID, user_id: USER_ID },
        JWT_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );
      
      req.headers.authorization = `Bearer ${expiredToken}`;
      
      await tenantContext(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Token has expired'
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should reject request with invalid token signature', async () => {
      const invalidToken = jwt.sign(
        { tenant_id: TENANT_ID, user_id: USER_ID },
        'wrong-secret'
      );
      
      req.headers.authorization = `Bearer ${invalidToken}`;
      
      await tenantContext(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid token'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
  
  describe('Tenant ID Validation', () => {
    test('should reject token without tenant_id', async () => {
      const token = jwt.sign(
        { user_id: USER_ID }, // Missing tenant_id
        JWT_SECRET
      );
      
      req.headers.authorization = `Bearer ${token}`;
      
      await tenantContext(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Token does not contain tenant_id'
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should reject invalid tenant_id format', async () => {
      const token = jwt.sign(
        { tenant_id: 'invalid-uuid', user_id: USER_ID },
        JWT_SECRET
      );
      
      req.headers.authorization = `Bearer ${token}`;
      
      await tenantContext(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Invalid tenant_id format'
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should accept valid UUID v4 tenant_id', async () => {
      const token = jwt.sign(
        { tenant_id: TENANT_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      req.headers.authorization = `Bearer ${token}`;
      
      // Mock successful database query
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      
      await tenantContext(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(req.tenant.id).toBe(TENANT_ID);
    });
  });
  
  describe('Database Session Variable', () => {
    test('should set PostgreSQL session variable with tenant_id', async () => {
      const token = jwt.sign(
        { tenant_id: TENANT_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      req.headers.authorization = `Bearer ${token}`;
      
      // Mock successful database query
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      
      await tenantContext(req, res, next);
      
      expect(mockClient.query).toHaveBeenCalledWith(
        'SET LOCAL app.current_tenant_id = $1',
        [TENANT_ID]
      );
      expect(next).toHaveBeenCalled();
    });
    
    test('should attach database client to request', async () => {
      const token = jwt.sign(
        { tenant_id: TENANT_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      req.headers.authorization = `Bearer ${token}`;
      
      // Mock successful database query
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      
      await tenantContext(req, res, next);
      
      expect(req.dbClient).toBe(mockClient);
      expect(getClient).toHaveBeenCalled();
    });
    
    test('should release database client on response finish', async () => {
      const token = jwt.sign(
        { tenant_id: TENANT_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      req.headers.authorization = `Bearer ${token}`;
      
      // Mock successful database query
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      
      await tenantContext(req, res, next);
      
      // Simulate response finish event
      const finishHandler = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishHandler();
      
      expect(mockClient.release).toHaveBeenCalled();
    });
    
    test('should release database client on response error', async () => {
      const token = jwt.sign(
        { tenant_id: TENANT_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      req.headers.authorization = `Bearer ${token}`;
      
      // Mock successful database query
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      
      await tenantContext(req, res, next);
      
      // Simulate response error event
      const errorHandler = res.on.mock.calls.find(call => call[0] === 'error')[1];
      errorHandler();
      
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
  
  describe('Tenant Context Attachment', () => {
    test('should attach tenant context to request object', async () => {
      const token = jwt.sign(
        {
          tenant_id: TENANT_ID,
          user_id: USER_ID,
          roles: ['teacher'],
          permissions: ['read:students', 'write:attendance']
        },
        JWT_SECRET
      );
      
      req.headers.authorization = `Bearer ${token}`;
      
      await tenantContext(req, res, next);
      
      expect(req.tenant).toEqual({
        id: TENANT_ID,
        user_id: USER_ID,
        roles: ['teacher'],
        permissions: ['read:students', 'write:attendance']
      });
    });
    
    test('should handle missing roles and permissions', async () => {
      const token = jwt.sign(
        { tenant_id: TENANT_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      req.headers.authorization = `Bearer ${token}`;
      
      await tenantContext(req, res, next);
      
      expect(req.tenant.roles).toEqual([]);
      expect(req.tenant.permissions).toEqual([]);
    });
  });
  
  describe('Performance Benchmarks', () => {
    test('should complete within 5ms overhead', async () => {
      const token = jwt.sign(
        { tenant_id: TENANT_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      req.headers.authorization = `Bearer ${token}`;
      
      const startTime = Date.now();
      await tenantContext(req, res, next);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(5);
      expect(req.tenantContextOverhead).toBeDefined();
      expect(req.tenantContextOverhead).toBeLessThan(5);
    });
    
    test('should log warning if overhead exceeds 5ms', async () => {
      // Mock slow database query
      mockClient.query.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ rows: [] }), 10))
      );
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const token = jwt.sign(
        { tenant_id: TENANT_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      req.headers.authorization = `Bearer ${token}`;
      
      await tenantContext(req, res, next);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Tenant context middleware overhead exceeded 5ms:',
        expect.objectContaining({
          tenant_id: TENANT_ID,
          path: '/api/students'
        })
      );
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('Error Handling', () => {
    test('should handle database connection errors', async () => {
      getClient.mockRejectedValueOnce(new Error('Connection failed'));
      
      const token = jwt.sign(
        { tenant_id: TENANT_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      req.headers.authorization = `Bearer ${token}`;
      
      await tenantContext(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Failed to establish tenant context'
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should release client on database query error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Query failed'));
      
      const token = jwt.sign(
        { tenant_id: TENANT_ID, user_id: USER_ID },
        JWT_SECRET
      );
      
      req.headers.authorization = `Bearer ${token}`;
      
      await tenantContext(req, res, next);
      
      expect(mockClient.release).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
  
  describe('Cross-Tenant Access Prevention', () => {
    test('validateTenantAccess should return true for same tenant', () => {
      const result = validateTenantAccess(TENANT_ID, TENANT_ID);
      expect(result).toBe(true);
    });
    
    test('validateTenantAccess should return false for different tenants', () => {
      const otherTenantId = '33333333-3333-3333-3333-333333333333';
      const result = validateTenantAccess(otherTenantId, TENANT_ID);
      expect(result).toBe(false);
    });
  });
  
  describe('Cross-Tenant Guard Middleware', () => {
    test('should allow access to same tenant resource', async () => {
      const getTenantId = jest.fn().mockResolvedValue(TENANT_ID);
      const guard = crossTenantGuard(getTenantId);
      
      req.tenant = { id: TENANT_ID };
      
      await guard(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    test('should block access to different tenant resource', async () => {
      const otherTenantId = '33333333-3333-3333-3333-333333333333';
      const getTenantId = jest.fn().mockResolvedValue(otherTenantId);
      const guard = crossTenantGuard(getTenantId);
      
      req.tenant = { id: TENANT_ID };
      
      await guard(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Cross-tenant access denied'
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should skip validation if resource has no tenant_id', async () => {
      const getTenantId = jest.fn().mockResolvedValue(null);
      const guard = crossTenantGuard(getTenantId);
      
      req.tenant = { id: TENANT_ID };
      
      await guard(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    test('should handle errors in tenant extraction', async () => {
      const getTenantId = jest.fn().mockRejectedValue(new Error('Extraction failed'));
      const guard = crossTenantGuard(getTenantId);
      
      req.tenant = { id: TENANT_ID };
      
      await guard(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Failed to validate tenant access'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
