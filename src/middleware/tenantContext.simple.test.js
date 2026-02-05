/**
 * Simplified Tenant Context Middleware Tests
 * 
 * Focused test suite covering core functionality
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

const { tenantContext, validateTenantAccess } = require('./tenantContext');
const { getClient } = require('../config/database');

describe('Tenant Context Middleware - Core Tests', () => {
  let req, res, next;
  const JWT_SECRET = 'test-secret-key';
  const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000'; // Valid UUID v4
  const USER_ID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8'; // Valid UUID v4
  
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
    
    req = {
      headers: {},
      path: '/api/students'
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      on: jest.fn()
    };
    
    next = jest.fn();
    
    // Default: successful database query
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });
  
  afterEach(() => {
    delete process.env.JWT_SECRET;
  });
  
  test('should reject request without Authorization header', async () => {
    await tenantContext(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
  
  test('should reject request with invalid token format', async () => {
    req.headers.authorization = 'InvalidFormat token123';
    
    await tenantContext(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
  
  test('should reject token without tenant_id', async () => {
    const token = jwt.sign({ user_id: USER_ID }, JWT_SECRET);
    req.headers.authorization = `Bearer ${token}`;
    
    await tenantContext(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
  
  test('should accept valid token and set tenant context', async () => {
    const token = jwt.sign(
      { tenant_id: TENANT_ID, user_id: USER_ID, roles: ['admin'] },
      JWT_SECRET
    );
    req.headers.authorization = `Bearer ${token}`;
    
    await tenantContext(req, res, next);
    
    expect(next).toHaveBeenCalled();
    expect(req.tenant).toEqual({
      id: TENANT_ID,
      user_id: USER_ID,
      roles: ['admin'],
      permissions: []
    });
  });
  
  test('should set PostgreSQL session variable', async () => {
    const token = jwt.sign(
      { tenant_id: TENANT_ID, user_id: USER_ID },
      JWT_SECRET
    );
    req.headers.authorization = `Bearer ${token}`;
    
    await tenantContext(req, res, next);
    
    expect(mockClient.query).toHaveBeenCalledWith(
      'SET LOCAL app.current_tenant_id = $1',
      [TENANT_ID]
    );
  });
  
  test('should attach database client to request', async () => {
    const token = jwt.sign(
      { tenant_id: TENANT_ID, user_id: USER_ID },
      JWT_SECRET
    );
    req.headers.authorization = `Bearer ${token}`;
    
    await tenantContext(req, res, next);
    
    expect(req.dbClient).toBe(mockClient);
    expect(getClient).toHaveBeenCalled();
  });
  
  test('should measure performance overhead', async () => {
    const token = jwt.sign(
      { tenant_id: TENANT_ID, user_id: USER_ID },
      JWT_SECRET
    );
    req.headers.authorization = `Bearer ${token}`;
    
    await tenantContext(req, res, next);
    
    expect(req.tenantContextOverhead).toBeDefined();
    expect(typeof req.tenantContextOverhead).toBe('number');
    expect(req.tenantContextOverhead).toBeLessThan(100); // Generous limit for test environment
  });
  
  test('validateTenantAccess should return true for same tenant', () => {
    expect(validateTenantAccess(TENANT_ID, TENANT_ID)).toBe(true);
  });
  
  test('validateTenantAccess should return false for different tenants', () => {
    const otherTenantId = '7c9e6679-7425-40de-944b-e07fc1f90ae7'; // Valid UUID v4
    expect(validateTenantAccess(otherTenantId, TENANT_ID)).toBe(false);
  });
});
