/**
 * EduOS Platform - Authentication Routes Tests
 * 
 * Integration tests for OAuth2/OIDC authentication endpoints
 */

const request = require('supertest');
const app = require('../server');
const { query } = require('../config/database');
const authService = require('../services/authService');

describe('Authentication Routes', () => {
  let testTenantId;
  let testUserId;
  let testAccessToken;
  let testRefreshToken;

  beforeAll(async () => {
    // Set test environment variables
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
    process.env.JWT_ISSUER = 'eduos-test';
    process.env.JWT_AUDIENCE = 'eduos-api-test';
    process.env.BASE_URL = 'http://localhost:3000';

    // Create test tenant
    const tenantResult = await query(
      `INSERT INTO tenants (name, subdomain, tier, status)
       VALUES ($1, $2, $3, $4)
       RETURNING tenant_id`,
      ['Test Auth Tenant', 'test-auth', 'Basic', 'active']
    );
    testTenantId = tenantResult.rows[0].tenant_id;

    // Create test user
    const userResult = await query(
      `INSERT INTO users (tenant_id, email, first_name, last_name, auth_provider, status, roles)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING user_id`,
      [testTenantId, 'test@example.com', 'Test', 'User', 'local', 'active', ['user']]
    );
    testUserId = userResult.rows[0].user_id;

    // Generate test tokens
    testAccessToken = authService.generateAccessToken({
      userId: testUserId,
      tenantId: testTenantId,
      email: 'test@example.com',
      roles: ['user'],
      permissions: [],
    });

    testRefreshToken = authService.generateRefreshToken({
      userId: testUserId,
      tenantId: testTenantId,
    });
  });

  afterAll(async () => {
    // Clean up test data
    await query('DELETE FROM users WHERE tenant_id = $1', [testTenantId]);
    await query('DELETE FROM tenants WHERE tenant_id = $1', [testTenantId]);
  });

  describe('GET /.well-known/openid-configuration', () => {
    test('should return OIDC discovery document', async () => {
      const response = await request(app)
        .get('/auth/.well-known/openid-configuration')
        .expect(200);

      expect(response.body).toHaveProperty('issuer');
      expect(response.body).toHaveProperty('authorization_endpoint');
      expect(response.body).toHaveProperty('token_endpoint');
      expect(response.body).toHaveProperty('userinfo_endpoint');
      expect(response.body).toHaveProperty('jwks_uri');
      expect(response.body).toHaveProperty('response_types_supported');
      expect(response.body.response_types_supported).toContain('code');
      expect(response.body).toHaveProperty('code_challenge_methods_supported');
      expect(response.body.code_challenge_methods_supported).toContain('S256');
    });
  });

  describe('GET /.well-known/jwks.json', () => {
    test('should return JWKS document', async () => {
      const response = await request(app)
        .get('/auth/.well-known/jwks.json')
        .expect(200);

      expect(response.body).toHaveProperty('keys');
      expect(Array.isArray(response.body.keys)).toBe(true);
    });
  });

  describe('GET /auth/:provider/login', () => {
    test('should reject request without tenant_id', async () => {
      const response = await request(app)
        .get('/auth/google/login')
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('tenant_id');
    });

    test('should reject invalid provider', async () => {
      const response = await request(app)
        .get('/auth/invalid/login')
        .query({ tenant_id: testTenantId })
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('Invalid provider');
    });

    test('should reject non-existent tenant', async () => {
      const response = await request(app)
        .get('/auth/google/login')
        .query({ tenant_id: '00000000-0000-0000-0000-000000000000' })
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toContain('Tenant not found');
    });

    test('should handle unconfigured OAuth provider gracefully', async () => {
      const response = await request(app)
        .get('/auth/google/login')
        .query({ tenant_id: testTenantId })
        .expect(500);

      expect(response.body.error).toBe('Internal Server Error');
    });
  });

  describe('POST /auth/token/refresh', () => {
    test('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/auth/token/refresh')
        .send({ refresh_token: testRefreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body).toHaveProperty('token_type');
      expect(response.body).toHaveProperty('expires_in');
      expect(response.body.token_type).toBe('Bearer');
      expect(response.body.expires_in).toBe(3600);
    });

    test('should reject request without refresh token', async () => {
      const response = await request(app)
        .post('/auth/token/refresh')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('refresh_token is required');
    });

    test('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/auth/token/refresh')
        .send({ refresh_token: 'invalid.token.here' })
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    test('should reject access token as refresh token', async () => {
      const response = await request(app)
        .post('/auth/token/refresh')
        .send({ refresh_token: testAccessToken })
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
      expect(response.body.message).toContain('Invalid token type');
    });
  });

  describe('POST /auth/token/verify', () => {
    test('should verify valid token', async () => {
      const response = await request(app)
        .post('/auth/token/verify')
        .send({ token: testAccessToken })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body).toHaveProperty('payload');
      expect(response.body.payload.sub).toBe(testUserId);
      expect(response.body.payload.tenant_id).toBe(testTenantId);
    });

    test('should reject request without token', async () => {
      const response = await request(app)
        .post('/auth/token/verify')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('token is required');
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .post('/auth/token/verify')
        .send({ token: 'invalid.token.here' })
        .expect(401);

      expect(response.body.valid).toBe(false);
    });
  });

  describe('GET /auth/userinfo', () => {
    test('should return user info with valid token', async () => {
      const response = await request(app)
        .get('/auth/userinfo')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('sub');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('given_name');
      expect(response.body).toHaveProperty('family_name');
      expect(response.body).toHaveProperty('tenant_id');
      expect(response.body).toHaveProperty('roles');
      expect(response.body.sub).toBe(testUserId);
      expect(response.body.email).toBe('test@example.com');
      expect(response.body.tenant_id).toBe(testTenantId);
    });

    test('should reject request without authorization header', async () => {
      const response = await request(app)
        .get('/auth/userinfo')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
      expect(response.body.message).toContain('Authorization header');
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/auth/userinfo')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    test('should reject request with malformed authorization header', async () => {
      const response = await request(app)
        .get('/auth/userinfo')
        .set('Authorization', 'InvalidFormat')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('POST /auth/logout', () => {
    test('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.message).toContain('Logged out successfully');
    });

    test('should logout successfully without token', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .expect(200);

      expect(response.body.message).toContain('Logged out successfully');
    });

    test('should create audit log entry on logout', async () => {
      await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200);

      // Verify audit log was created
      const auditResult = await query(
        `SELECT * FROM audit_logs 
         WHERE tenant_id = $1 AND user_id = $2 AND action = 'user_logout'
         ORDER BY created_at DESC LIMIT 1`,
        [testTenantId, testUserId]
      );

      expect(auditResult.rowCount).toBeGreaterThan(0);
      expect(auditResult.rows[0].action).toBe('user_logout');
    });
  });

  describe('Token Expiration', () => {
    test('should include correct expiration time in tokens', async () => {
      const response = await request(app)
        .post('/auth/token/refresh')
        .send({ refresh_token: testRefreshToken })
        .expect(200);

      expect(response.body.expires_in).toBe(3600); // 1 hour
    });
  });

  describe('Security Headers', () => {
    test('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/auth/.well-known/openid-configuration')
        .expect(200);

      // Helmet middleware should add security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Create token with non-existent user
      const invalidToken = authService.generateAccessToken({
        userId: '00000000-0000-0000-0000-000000000000',
        tenantId: testTenantId,
        email: 'nonexistent@example.com',
        roles: [],
        permissions: [],
      });

      const response = await request(app)
        .get('/auth/userinfo')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toContain('User not found');
    });
  });

  describe('OAuth2 Authorization Code Flow', () => {
    test('should support PKCE (Proof Key for Code Exchange)', async () => {
      const discovery = await request(app)
        .get('/auth/.well-known/openid-configuration')
        .expect(200);

      expect(discovery.body.code_challenge_methods_supported).toContain('S256');
    });

    test('should support authorization code response type', async () => {
      const discovery = await request(app)
        .get('/auth/.well-known/openid-configuration')
        .expect(200);

      expect(discovery.body.response_types_supported).toContain('code');
    });
  });

  describe('OIDC Standard Compliance', () => {
    test('should expose required OIDC endpoints', async () => {
      const discovery = await request(app)
        .get('/auth/.well-known/openid-configuration')
        .expect(200);

      expect(discovery.body).toHaveProperty('authorization_endpoint');
      expect(discovery.body).toHaveProperty('token_endpoint');
      expect(discovery.body).toHaveProperty('userinfo_endpoint');
      expect(discovery.body).toHaveProperty('jwks_uri');
    });

    test('should support required OIDC scopes', async () => {
      const discovery = await request(app)
        .get('/auth/.well-known/openid-configuration')
        .expect(200);

      expect(discovery.body.scopes_supported).toContain('openid');
      expect(discovery.body.scopes_supported).toContain('email');
      expect(discovery.body.scopes_supported).toContain('profile');
    });

    test('should support required OIDC claims', async () => {
      const discovery = await request(app)
        .get('/auth/.well-known/openid-configuration')
        .expect(200);

      expect(discovery.body.claims_supported).toContain('sub');
      expect(discovery.body.claims_supported).toContain('email');
      expect(discovery.body.claims_supported).toContain('name');
    });
  });
});
