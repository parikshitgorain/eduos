/**
 * EduOS Platform - Authentication Routes Tests
 * 
 * Integration tests for OAuth2/OIDC authentication endpoints
 */

const request = require('supertest');
const app = require('../server');
const { query } = require('../config/database');
const authService = require('../services/authService');
const rbacService = require('../services/rbacService');

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

  describe('GET /auth/permissions', () => {
    beforeAll(async () => {
      // Create default roles for the test tenant
      await rbacService.createDefaultRoles(testTenantId);

      // Get the teacher role
      const roles = await rbacService.getTenantRoles(testTenantId);
      const teacherRole = roles.find(r => r.roleName === 'teacher');

      // Assign teacher role to test user
      if (teacherRole) {
        await rbacService.assignRoleToUser(testUserId, teacherRole.roleId, testTenantId, testUserId);
      }
    });

    test('should return user permissions with valid token', async () => {
      const response = await request(app)
        .get('/auth/permissions')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user_id');
      expect(response.body).toHaveProperty('tenant_id');
      expect(response.body).toHaveProperty('roles');
      expect(response.body).toHaveProperty('permissions');
      expect(response.body).toHaveProperty('hierarchy');
      expect(response.body.user_id).toBe(testUserId);
      expect(response.body.tenant_id).toBe(testTenantId);
      expect(Array.isArray(response.body.roles)).toBe(true);
      expect(Array.isArray(response.body.permissions)).toBe(true);
    });

    test('should include role hierarchy information', async () => {
      const response = await request(app)
        .get('/auth/permissions')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.hierarchy).toHaveProperty('description');
      expect(response.body.hierarchy).toHaveProperty('levels');
      expect(response.body.hierarchy.description).toContain('SuperAdmin');
      expect(response.body.hierarchy.description).toContain('Teacher');
      expect(response.body.hierarchy.description).toContain('Student');
      expect(response.body.hierarchy.levels).toHaveProperty('0', 'SuperAdmin');
      expect(response.body.hierarchy.levels).toHaveProperty('4', 'Student');
    });

    test('should include inherited permissions from parent roles', async () => {
      const response = await request(app)
        .get('/auth/permissions')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200);

      // Teacher should have permissions from their role and parent roles
      expect(response.body.permissions.length).toBeGreaterThan(0);
    });

    test('should reject request without authorization header', async () => {
      const response = await request(app)
        .get('/auth/permissions')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
      expect(response.body.message).toContain('Authorization header');
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/auth/permissions')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('GET /auth/permissions/fields/:resourceType', () => {
    beforeAll(async () => {
      // Set up field permissions for the teacher role
      const roles = await rbacService.getTenantRoles(testTenantId);
      const teacherRole = roles.find(r => r.roleName === 'teacher');

      if (teacherRole) {
        await rbacService.setFieldPermission(
          teacherRole.roleId,
          testTenantId,
          'first_name',
          'student',
          true,
          true
        );
        await rbacService.setFieldPermission(
          teacherRole.roleId,
          testTenantId,
          'email',
          'student',
          true,
          false
        );
      }
    });

    test('should return field-level permissions for a resource type', async () => {
      const response = await request(app)
        .get('/auth/permissions/fields/student')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user_id');
      expect(response.body).toHaveProperty('tenant_id');
      expect(response.body).toHaveProperty('resource_type');
      expect(response.body).toHaveProperty('field_permissions');
      expect(response.body.resource_type).toBe('student');
      expect(Array.isArray(response.body.field_permissions)).toBe(true);
    });

    test('should include read and write permissions for each field', async () => {
      const response = await request(app)
        .get('/auth/permissions/fields/student')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200);

      if (response.body.field_permissions.length > 0) {
        const fieldPerm = response.body.field_permissions[0];
        expect(fieldPerm).toHaveProperty('fieldName');
        expect(fieldPerm).toHaveProperty('canRead');
        expect(fieldPerm).toHaveProperty('canWrite');
        expect(typeof fieldPerm.canRead).toBe('boolean');
        expect(typeof fieldPerm.canWrite).toBe('boolean');
      }
    });

    test('should reject request without authorization header', async () => {
      const response = await request(app)
        .get('/auth/permissions/fields/student')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/auth/permissions/fields/student')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });
  });

  // ============================================================================
  // ADDITIONAL TESTS FOR 90%+ COVERAGE
  // ============================================================================

  describe('GET /auth/:provider/login - Additional Coverage', () => {
    test('should reject invalid provider', async () => {
      const response = await request(app)
        .get('/auth/invalid-provider/login')
        .query({ tenant_id: testTenantId })
        .expect(400);

      expect(response.body.message).toBe('Invalid provider. Supported providers: google, microsoft');
    });

    test('should reject request for non-existent tenant', async () => {
      const response = await request(app)
        .get('/auth/google/login')
        .query({ tenant_id: '00000000-0000-0000-0000-000000000000' })
        .expect(404);

      expect(response.body.message).toBe('Tenant not found');
    });

    test('should reject request for inactive tenant', async () => {
      // Create inactive tenant
      const inactiveTenantResult = await query(
        `INSERT INTO tenants (name, subdomain, tier, status)
         VALUES ($1, $2, $3, $4)
         RETURNING tenant_id`,
        ['Inactive Tenant', 'inactive-test', 'Basic', 'suspended']
      );
      const inactiveTenantId = inactiveTenantResult.rows[0].tenant_id;

      const response = await request(app)
        .get('/auth/google/login')
        .query({ tenant_id: inactiveTenantId })
        .expect(403);

      expect(response.body.message).toBe('Tenant is not active');

      // Cleanup
      await query('DELETE FROM tenants WHERE tenant_id = $1', [inactiveTenantId]);
    });

    test('should handle database errors during tenant lookup', async () => {
      // Mock database query to throw error
      const originalQuery = require('../config/database').query;
      jest.spyOn(require('../config/database'), 'query').mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/auth/google/login')
        .query({ tenant_id: testTenantId })
        .expect(500);

      expect(response.body.error).toBe('Internal Server Error');

      // Restore original
      require('../config/database').query.mockRestore();
    });

    test('should generate authorization URL for google', async () => {
      // Mock authService.getAuthorizationUrl
      jest.spyOn(authService, 'getAuthorizationUrl').mockReturnValueOnce({
        url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test',
        state: 'test-state-123'
      });

      const response = await request(app)
        .get('/auth/google/login')
        .query({ tenant_id: testTenantId })
        .expect(200);

      expect(response.body).toHaveProperty('authorization_url');
      expect(response.body).toHaveProperty('state');
      expect(response.body.provider).toBe('google');

      authService.getAuthorizationUrl.mockRestore();
    });

    test('should generate authorization URL for microsoft', async () => {
      // Mock authService.getAuthorizationUrl
      jest.spyOn(authService, 'getAuthorizationUrl').mockReturnValueOnce({
        url: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=test',
        state: 'test-state-456'
      });

      const response = await request(app)
        .get('/auth/microsoft/login')
        .query({ tenant_id: testTenantId })
        .expect(200);

      expect(response.body).toHaveProperty('authorization_url');
      expect(response.body).toHaveProperty('state');
      expect(response.body.provider).toBe('microsoft');

      authService.getAuthorizationUrl.mockRestore();
    });
  });

  describe('GET /auth/:provider/callback - OAuth Callback Coverage', () => {
    test('should handle OAuth error in callback', async () => {
      const response = await request(app)
        .get('/auth/google/callback')
        .query({
          error: 'access_denied',
          error_description: 'User denied access'
        })
        .expect(400);

      expect(response.body.error).toBe('OAuth2 Error');
      expect(response.body.message).toBe('User denied access');
    });

    test('should handle OAuth error without description', async () => {
      const response = await request(app)
        .get('/auth/google/callback')
        .query({
          error: 'server_error'
        })
        .expect(400);

      expect(response.body.error).toBe('OAuth2 Error');
      expect(response.body.message).toBe('server_error');
    });

    test('should reject callback without code', async () => {
      const response = await request(app)
        .get('/auth/google/callback')
        .query({
          state: 'test-state'
        })
        .expect(400);

      expect(response.body.message).toBe('Missing code or state parameter');
    });

    test('should reject callback without state', async () => {
      const response = await request(app)
        .get('/auth/google/callback')
        .query({
          code: 'test-code'
        })
        .expect(400);

      expect(response.body.message).toBe('Missing code or state parameter');
    });

    test('should create new user on first login', async () => {
      // Mock authService.handleCallback to return new user info
      jest.spyOn(authService, 'handleCallback').mockResolvedValueOnce({
        email: 'newuser@example.com',
        tenantId: testTenantId,
        name: 'New User',
        givenName: 'New',
        familyName: 'User',
        providerId: 'google-123456'
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .query({
          code: 'test-code',
          state: 'test-state'
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body.user.email).toBe('newuser@example.com');
      expect(response.body.user.roles).toContain('user');

      // Cleanup
      await query('DELETE FROM users WHERE email = $1 AND tenant_id = $2', 
        ['newuser@example.com', testTenantId]);

      authService.handleCallback.mockRestore();
    });

    test('should reject login for inactive user', async () => {
      // Create inactive user
      const inactiveUserResult = await query(
        `INSERT INTO users (tenant_id, email, first_name, last_name, auth_provider, status, roles)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING user_id`,
        [testTenantId, 'inactive@example.com', 'Inactive', 'User', 'google', 'suspended', ['user']]
      );

      // Mock authService.handleCallback
      jest.spyOn(authService, 'handleCallback').mockResolvedValueOnce({
        email: 'inactive@example.com',
        tenantId: testTenantId,
        name: 'Inactive User',
        givenName: 'Inactive',
        familyName: 'User',
        providerId: 'google-inactive'
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .query({
          code: 'test-code',
          state: 'test-state'
        })
        .expect(403);

      expect(response.body.message).toBe('User account is not active');

      // Cleanup
      await query('DELETE FROM users WHERE user_id = $1', [inactiveUserResult.rows[0].user_id]);
      authService.handleCallback.mockRestore();
    });

    test('should update last login for existing user', async () => {
      // Mock authService.handleCallback
      jest.spyOn(authService, 'handleCallback').mockResolvedValueOnce({
        email: 'test@example.com',
        tenantId: testTenantId,
        name: 'Test User',
        givenName: 'Test',
        familyName: 'User',
        providerId: 'google-test'
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .query({
          code: 'test-code',
          state: 'test-state'
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body.user.email).toBe('test@example.com');

      // Verify last_login_at was updated
      const userCheck = await query(
        'SELECT last_login_at FROM users WHERE user_id = $1',
        [testUserId]
      );
      expect(userCheck.rows[0].last_login_at).not.toBeNull();

      authService.handleCallback.mockRestore();
    });

    test('should handle callback errors gracefully', async () => {
      // Mock authService.handleCallback to throw error
      jest.spyOn(authService, 'handleCallback').mockRejectedValueOnce(
        new Error('Invalid authorization code')
      );

      const response = await request(app)
        .get('/auth/google/callback')
        .query({
          code: 'invalid-code',
          state: 'test-state'
        })
        .expect(500);

      expect(response.body.error).toBe('Internal Server Error');

      authService.handleCallback.mockRestore();
    });
  });

  describe('POST /auth/token/refresh - Additional Coverage', () => {
    test('should reject refresh without token', async () => {
      const response = await request(app)
        .post('/auth/token/refresh')
        .send({})
        .expect(400);

      expect(response.body.message).toBe('refresh_token is required');
    });

    test('should handle invalid refresh token', async () => {
      const response = await request(app)
        .post('/auth/token/refresh')
        .send({ refresh_token: 'invalid-token' })
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    test('should handle expired refresh token', async () => {
      // Mock authService.refreshAccessToken to throw error for expired token
      jest.spyOn(authService, 'refreshAccessToken').mockRejectedValueOnce(
        new Error('Refresh token expired')
      );

      const response = await request(app)
        .post('/auth/token/refresh')
        .send({ refresh_token: 'expired-token' })
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');

      authService.refreshAccessToken.mockRestore();
    });
  });

  describe('POST /auth/token/verify - Additional Coverage', () => {
    test('should reject verification without token', async () => {
      const response = await request(app)
        .post('/auth/token/verify')
        .send({})
        .expect(400);

      expect(response.body.message).toBe('token is required');
    });

    test('should reject invalid token format', async () => {
      const response = await request(app)
        .post('/auth/token/verify')
        .send({ token: 'not-a-valid-jwt' })
        .expect(401);

      expect(response.body.valid).toBe(false);
    });

    test('should reject expired token', async () => {
      // Mock authService.verifyToken to throw error for expired token
      jest.spyOn(authService, 'verifyToken').mockImplementationOnce(() => {
        throw new Error('Token expired');
      });

      const response = await request(app)
        .post('/auth/token/verify')
        .send({ token: 'expired-token' })
        .expect(401);

      expect(response.body.valid).toBe(false);

      authService.verifyToken.mockRestore();
    });

    test('should verify valid token successfully', async () => {
      const response = await request(app)
        .post('/auth/token/verify')
        .send({ token: testAccessToken })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.payload).toHaveProperty('sub');
      expect(response.body.payload).toHaveProperty('tenant_id');
    });
  });

  describe('GET /auth/userinfo - Additional Coverage', () => {
    test('should reject request without authorization header', async () => {
      const response = await request(app)
        .get('/auth/userinfo')
        .expect(401);

      expect(response.body.message).toBe('Missing or invalid Authorization header');
    });

    test('should reject request with invalid authorization header format', async () => {
      const response = await request(app)
        .get('/auth/userinfo')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body.message).toBe('Missing or invalid Authorization header');
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/auth/userinfo')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    test('should return 404 for non-existent user', async () => {
      // Generate token for non-existent user
      const fakeToken = authService.generateAccessToken({
        userId: '00000000-0000-0000-0000-000000000000',
        tenantId: testTenantId,
        email: 'fake@example.com',
        roles: ['user'],
        permissions: [],
      });

      const response = await request(app)
        .get('/auth/userinfo')
        .set('Authorization', `Bearer ${fakeToken}`)
        .expect(404);

      expect(response.body.message).toBe('User not found');
    });

    test('should return user info with valid token', async () => {
      const response = await request(app)
        .get('/auth/userinfo')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.sub).toBe(testUserId);
      expect(response.body.email).toBe('test@example.com');
      expect(response.body.tenant_id).toBe(testTenantId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('roles');
    });
  });

  describe('POST /auth/logout - Additional Coverage', () => {
    test('should logout without token (anonymous logout)', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .expect(200);

      expect(response.body.message).toBe('Logged out successfully');
    });

    test('should logout with invalid token gracefully', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(200);

      expect(response.body.message).toBe('Logged out successfully');
    });

    test('should logout and log audit event with valid token', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.message).toBe('Logged out successfully');

      // Verify audit log was created
      const auditLog = await query(
        `SELECT * FROM audit_logs 
         WHERE user_id = $1 AND action = 'user_logout' 
         ORDER BY created_at DESC LIMIT 1`,
        [testUserId]
      );
      expect(auditLog.rowCount).toBeGreaterThan(0);
    });
  });

  describe('GET /auth/permissions - Additional Coverage', () => {
    test('should reject request without authorization header', async () => {
      const response = await request(app)
        .get('/auth/permissions')
        .expect(401);

      expect(response.body.message).toBe('Missing or invalid Authorization header');
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/auth/permissions')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    test('should handle rbacService errors gracefully', async () => {
      // Mock rbacService to throw error
      jest.spyOn(rbacService, 'getUserPermissions').mockRejectedValueOnce(
        new Error('RBAC service unavailable')
      );

      const response = await request(app)
        .get('/auth/permissions')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');

      rbacService.getUserPermissions.mockRestore();
    });
  });

  describe('GET /auth/permissions/fields/:resourceType - Additional Coverage', () => {
    test('should reject request without authorization header', async () => {
      const response = await request(app)
        .get('/auth/permissions/fields/student')
        .expect(401);

      expect(response.body.message).toBe('Missing or invalid Authorization header');
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/auth/permissions/fields/student')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    test('should handle rbacService errors gracefully', async () => {
      // Mock rbacService to throw error
      jest.spyOn(rbacService, 'getUserFieldPermissions').mockRejectedValueOnce(
        new Error('Field permissions unavailable')
      );

      const response = await request(app)
        .get('/auth/permissions/fields/student')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');

      rbacService.getUserFieldPermissions.mockRestore();
    });

    test('should return field permissions for valid request', async () => {
      // Mock rbacService
      jest.spyOn(rbacService, 'getUserFieldPermissions').mockResolvedValueOnce({
        name: { read: true, write: false },
        email: { read: true, write: false },
        grade: { read: true, write: true }
      });

      const response = await request(app)
        .get('/auth/permissions/fields/student')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.resource_type).toBe('student');
      expect(response.body).toHaveProperty('field_permissions');

      rbacService.getUserFieldPermissions.mockRestore();
    });
  });
});
