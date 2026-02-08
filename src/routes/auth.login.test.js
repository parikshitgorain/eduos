/**
 * Tests for Email/Password Authentication Endpoints
 * 
 * Tests the new login, MFA, and forgot password endpoints
 */

const request = require('supertest');
const express = require('express');
const authRoutes = require('./auth');
const { query } = require('../config/database');
const bcrypt = require('bcrypt');

// Mock dependencies
jest.mock('../config/database');
jest.mock('../config/redis');
jest.mock('../services/authService');
jest.mock('../services/mfaService');

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('POST /auth/api/v1/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if required fields are missing', async () => {
    const response = await request(app)
      .post('/auth/api/v1/auth/login')
      .send({
        email: 'test@example.com'
        // Missing tenantId and password
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Missing required fields');
  });

  it('should return 401 for invalid credentials', async () => {
    query.mockResolvedValue({ rowCount: 0, rows: [] });

    const response = await request(app)
      .post('/auth/api/v1/auth/login')
      .send({
        tenantId: 'test-tenant-id',
        email: 'test@example.com',
        password: 'wrongpassword',
        rememberMe: false
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Invalid email or password');
  });

  it('should return 403 for inactive user', async () => {
    query.mockResolvedValue({
      rowCount: 1,
      rows: [{
        user_id: 'user-123',
        tenant_id: 'tenant-123',
        email: 'test@example.com',
        password_hash: await bcrypt.hash('password123', 10),
        mfa_enabled: false,
        status: 'suspended',
        roles: ['user']
      }]
    });

    const response = await request(app)
      .post('/auth/api/v1/auth/login')
      .send({
        tenantId: 'tenant-123',
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Account is not active');
  });

  it('should return MFA session if MFA is enabled', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    
    query.mockResolvedValue({
      rowCount: 1,
      rows: [{
        user_id: 'user-123',
        tenant_id: 'tenant-123',
        email: 'test@example.com',
        password_hash: passwordHash,
        mfa_enabled: true,
        status: 'active',
        roles: ['user']
      }]
    });

    const redis = require('../config/redis');
    redis.set = jest.fn().mockResolvedValue('OK');

    const response = await request(app)
      .post('/auth/api/v1/auth/login')
      .send({
        tenantId: 'tenant-123',
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.requiresMFA).toBe(true);
    expect(response.body.sessionId).toBeDefined();
    expect(redis.set).toHaveBeenCalled();
  });

  it('should return token for successful login without MFA', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    
    query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          user_id: 'user-123',
          tenant_id: 'tenant-123',
          email: 'test@example.com',
          password_hash: passwordHash,
          mfa_enabled: false,
          status: 'active',
          roles: ['user']
        }]
      })
      .mockResolvedValueOnce({ rowCount: 1 }); // audit log insert

    const authService = require('../services/authService');
    authService.generateAccessToken = jest.fn().mockReturnValue('mock-jwt-token');

    const response = await request(app)
      .post('/auth/api/v1/auth/login')
      .send({
        tenantId: 'tenant-123',
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.requiresMFA).toBe(false);
    expect(response.body.token).toBe('mock-jwt-token');
    expect(authService.generateAccessToken).toHaveBeenCalled();
  });
});

describe('POST /auth/api/v1/auth/mfa/verify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if required fields are missing', async () => {
    const response = await request(app)
      .post('/auth/api/v1/auth/mfa/verify')
      .send({
        sessionId: 'session-123'
        // Missing otp
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 401 for invalid session', async () => {
    const redis = require('../config/redis');
    redis.get = jest.fn().mockResolvedValue(null);

    const response = await request(app)
      .post('/auth/api/v1/auth/mfa/verify')
      .send({
        sessionId: 'invalid-session',
        otp: '123456'
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Invalid or expired session');
  });

  it('should return 401 for invalid OTP', async () => {
    const redis = require('../config/redis');
    redis.get = jest.fn().mockResolvedValue(JSON.stringify({
      userId: 'user-123',
      tenantId: 'tenant-123'
    }));

    const mfaService = require('../services/mfaService');
    mfaService.verifyTOTP = jest.fn().mockResolvedValue(false);

    const response = await request(app)
      .post('/auth/api/v1/auth/mfa/verify')
      .send({
        sessionId: 'session-123',
        otp: '000000'
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Invalid verification code');
  });

  it('should return token for valid OTP', async () => {
    const redis = require('../config/redis');
    redis.get = jest.fn().mockResolvedValue(JSON.stringify({
      userId: 'user-123',
      tenantId: 'tenant-123'
    }));
    redis.del = jest.fn().mockResolvedValue(1);

    const mfaService = require('../services/mfaService');
    mfaService.verifyTOTP = jest.fn().mockResolvedValue(true);

    query.mockResolvedValue({
      rows: [{
        user_id: 'user-123',
        tenant_id: 'tenant-123',
        email: 'test@example.com',
        roles: ['user']
      }]
    });

    const authService = require('../services/authService');
    authService.generateAccessToken = jest.fn().mockReturnValue('mock-jwt-token');

    const response = await request(app)
      .post('/auth/api/v1/auth/mfa/verify')
      .send({
        sessionId: 'session-123',
        otp: '123456'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.token).toBe('mock-jwt-token');
    expect(redis.del).toHaveBeenCalledWith('mfa_session:session-123');
  });
});

describe('POST /auth/api/v1/auth/forgot-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if email is missing', async () => {
    const response = await request(app)
      .post('/auth/api/v1/auth/forgot-password')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Email is required');
  });

  it('should return success even if user does not exist', async () => {
    query.mockResolvedValue({ rowCount: 0, rows: [] });

    const response = await request(app)
      .post('/auth/api/v1/auth/forgot-password')
      .send({
        email: 'nonexistent@example.com'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toContain('If an account exists');
  });

  it('should create reset token for existing user', async () => {
    query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          user_id: 'user-123',
          tenant_id: 'tenant-123',
          email: 'test@example.com',
          first_name: 'Test'
        }]
      })
      .mockResolvedValueOnce({ rowCount: 1 }); // insert token

    const response = await request(app)
      .post('/auth/api/v1/auth/forgot-password')
      .send({
        email: 'test@example.com',
        tenantId: 'tenant-123'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(query).toHaveBeenCalledTimes(2);
  });
});

describe('GET /auth/api/v1/auth/sso/:provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if tenantId is missing', async () => {
    const response = await request(app)
      .get('/auth/api/v1/auth/sso/google');

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('tenantId');
  });

  it('should return 400 for invalid provider', async () => {
    const response = await request(app)
      .get('/auth/api/v1/auth/sso/invalid')
      .query({ tenantId: 'tenant-123' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Invalid provider');
  });

  it('should return 404 for non-existent tenant', async () => {
    query.mockResolvedValue({ rowCount: 0, rows: [] });

    const response = await request(app)
      .get('/auth/api/v1/auth/sso/google')
      .query({ tenantId: 'nonexistent' });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Tenant not found');
  });

  it('should return authorization URL for valid request', async () => {
    query.mockResolvedValue({
      rowCount: 1,
      rows: [{
        tenant_id: 'tenant-123',
        name: 'Test Tenant',
        status: 'active'
      }]
    });

    const authService = require('../services/authService');
    authService.getAuthorizationUrl = jest.fn().mockReturnValue({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?...',
      state: 'random-state'
    });

    const response = await request(app)
      .get('/auth/api/v1/auth/sso/google')
      .query({ tenantId: 'tenant-123' });

    expect(response.status).toBe(200);
    expect(response.body.authorizationUrl).toBeDefined();
    expect(response.body.state).toBe('random-state');
    expect(response.body.provider).toBe('google');
  });
});
