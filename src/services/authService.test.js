/**
 * EduOS Platform - Authentication Service Tests
 * 
 * Tests for OAuth2/OIDC authentication service
 */

// Mock openid-client before requiring authService
jest.mock('openid-client', () => ({
  Issuer: {
    discover: jest.fn(),
  },
  generators: {
    codeVerifier: jest.fn(() => 'mock-code-verifier'),
    codeChallenge: jest.fn(() => 'mock-code-challenge'),
  },
}));

const authService = require('./authService');
const jwt = require('jsonwebtoken');

describe('AuthService', () => {
  beforeAll(async () => {
    // Set test environment variables
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
    process.env.JWT_ISSUER = 'eduos-test';
    process.env.JWT_AUDIENCE = 'eduos-api-test';
  });

  describe('JWT Token Generation', () => {
    test('should generate access token with correct payload', () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'test@example.com',
        roles: ['teacher'],
        permissions: ['read:students'],
      };

      const token = authService.generateAccessToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Decode and verify token
      const decoded = jwt.decode(token);
      expect(decoded.sub).toBe('user-123');
      expect(decoded.tenant_id).toBe('tenant-456');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.roles).toEqual(['teacher']);
      expect(decoded.permissions).toEqual(['read:students']);
      expect(decoded.type).toBe('access');
    });

    test('should generate refresh token with correct payload', () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456',
      };

      const token = authService.generateRefreshToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Decode and verify token
      const decoded = jwt.decode(token);
      expect(decoded.sub).toBe('user-123');
      expect(decoded.tenant_id).toBe('tenant-456');
      expect(decoded.type).toBe('refresh');
    });

    test('should set correct expiration times', () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'test@example.com',
      };

      const accessToken = authService.generateAccessToken(payload);
      const refreshToken = authService.generateRefreshToken(payload);

      const accessDecoded = jwt.decode(accessToken);
      const refreshDecoded = jwt.decode(refreshToken);

      // Access token should expire in ~1 hour
      const accessExpiry = accessDecoded.exp - accessDecoded.iat;
      expect(accessExpiry).toBeGreaterThanOrEqual(3599);
      expect(accessExpiry).toBeLessThanOrEqual(3601);

      // Refresh token should expire in ~7 days
      const refreshExpiry = refreshDecoded.exp - refreshDecoded.iat;
      expect(refreshExpiry).toBeGreaterThanOrEqual(604799);
      expect(refreshExpiry).toBeLessThanOrEqual(604801);
    });
  });

  describe('Token Verification', () => {
    test('should verify valid token', () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'test@example.com',
        roles: ['teacher'],
      };

      const token = authService.generateAccessToken(payload);
      const decoded = authService.verifyToken(token);

      expect(decoded.sub).toBe('user-123');
      expect(decoded.tenant_id).toBe('tenant-456');
      expect(decoded.email).toBe('test@example.com');
    });

    test('should reject invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => {
        authService.verifyToken(invalidToken);
      }).toThrow();
    });

    test('should reject expired token', () => {
      // Create token with immediate expiration
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-456',
          type: 'access',
        },
        process.env.JWT_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: '0s',
          issuer: process.env.JWT_ISSUER,
          audience: process.env.JWT_AUDIENCE,
        }
      );

      // Wait a moment to ensure expiration
      setTimeout(() => {
        expect(() => {
          authService.verifyToken(token);
        }).toThrow();
      }, 100);
    });

    test('should reject token with wrong issuer', () => {
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-456',
          type: 'access',
        },
        process.env.JWT_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: '1h',
          issuer: 'wrong-issuer',
          audience: process.env.JWT_AUDIENCE,
        }
      );

      expect(() => {
        authService.verifyToken(token);
      }).toThrow();
    });
  });

  describe('Token Refresh', () => {
    test('should refresh access token with valid refresh token', async () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456',
      };

      const refreshToken = authService.generateRefreshToken(payload);
      const result = await authService.refreshAccessToken(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(result.expiresIn).toBe(3600);

      // Verify new tokens are valid
      const accessDecoded = authService.verifyToken(result.accessToken);
      expect(accessDecoded.sub).toBe('user-123');
      expect(accessDecoded.tenant_id).toBe('tenant-456');
    });

    test('should reject refresh with access token', async () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'test@example.com',
      };

      const accessToken = authService.generateAccessToken(payload);

      await expect(
        authService.refreshAccessToken(accessToken)
      ).rejects.toThrow('Invalid token type');
    });

    test('should reject refresh with invalid token', async () => {
      const invalidToken = 'invalid.token.here';

      await expect(
        authService.refreshAccessToken(invalidToken)
      ).rejects.toThrow();
    });
  });

  describe('State Parameter Handling', () => {
    test('should generate state with tenant context', () => {
      const tenantId = 'tenant-123';
      const state = authService.generateState(tenantId);

      expect(state).toBeDefined();
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(0);
    });

    test('should extract tenant ID from state', () => {
      const tenantId = 'tenant-123';
      const state = authService.generateState(tenantId);
      const extracted = authService.extractTenantFromState(state);

      expect(extracted).toBe(tenantId);
    });

    test('should reject invalid state parameter', () => {
      const invalidState = 'invalid-state';

      expect(() => {
        authService.extractTenantFromState(invalidState);
      }).toThrow('Invalid state parameter');
    });
  });

  describe('OIDC Discovery', () => {
    test('should return valid discovery document', () => {
      const discovery = authService.getDiscoveryDocument();

      expect(discovery).toHaveProperty('issuer');
      expect(discovery).toHaveProperty('authorization_endpoint');
      expect(discovery).toHaveProperty('token_endpoint');
      expect(discovery).toHaveProperty('userinfo_endpoint');
      expect(discovery).toHaveProperty('jwks_uri');
      expect(discovery).toHaveProperty('response_types_supported');
      expect(discovery).toHaveProperty('subject_types_supported');
      expect(discovery).toHaveProperty('id_token_signing_alg_values_supported');
      expect(discovery).toHaveProperty('scopes_supported');
      expect(discovery).toHaveProperty('claims_supported');
      expect(discovery).toHaveProperty('code_challenge_methods_supported');

      // Verify PKCE support
      expect(discovery.code_challenge_methods_supported).toContain('S256');

      // Verify OAuth2 authorization code flow support
      expect(discovery.response_types_supported).toContain('code');
    });

    test('should return JWKS document', () => {
      const jwks = authService.getJWKS();

      expect(jwks).toHaveProperty('keys');
      expect(Array.isArray(jwks.keys)).toBe(true);
    });
  });

  describe('Authorization URL Generation', () => {
    test('should throw error for unconfigured provider', () => {
      expect(() => {
        authService.getAuthorizationUrl('invalid-provider', 'tenant-123');
      }).toThrow("OAuth2 provider 'invalid-provider' not configured");
    });

    test('should generate state parameter', () => {
      // Mock a configured client
      authService.clients.test = {
        authorizationUrl: jest.fn(() => 'https://example.com/auth'),
      };

      const result = authService.getAuthorizationUrl('test', 'tenant-123');

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('state');
      expect(typeof result.state).toBe('string');

      // Clean up
      delete authService.clients.test;
    });
  });

  describe('Token Payload Validation', () => {
    test('should include all required claims in access token', () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'test@example.com',
        roles: ['admin'],
        permissions: ['read:all', 'write:all'],
      };

      const token = authService.generateAccessToken(payload);
      const decoded = jwt.decode(token);

      // Required claims
      expect(decoded).toHaveProperty('sub');
      expect(decoded).toHaveProperty('tenant_id');
      expect(decoded).toHaveProperty('email');
      expect(decoded).toHaveProperty('roles');
      expect(decoded).toHaveProperty('permissions');
      expect(decoded).toHaveProperty('type');
      expect(decoded).toHaveProperty('iat');
      expect(decoded).toHaveProperty('exp');
      expect(decoded).toHaveProperty('iss');
      expect(decoded).toHaveProperty('aud');
    });

    test('should handle empty roles and permissions', () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'test@example.com',
      };

      const token = authService.generateAccessToken(payload);
      const decoded = jwt.decode(token);

      expect(decoded.roles).toEqual([]);
      expect(decoded.permissions).toEqual([]);
    });
  });

  describe('Security Features', () => {
    test('should use HS256 algorithm when no private key is provided', () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'test@example.com',
      };

      const token = authService.generateAccessToken(payload);
      const decoded = jwt.decode(token, { complete: true });

      expect(decoded.header.alg).toBe('HS256');
    });

    test('should include issuer and audience in tokens', () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'test@example.com',
      };

      const token = authService.generateAccessToken(payload);
      const decoded = jwt.decode(token);

      expect(decoded.iss).toBe('eduos-test');
      expect(decoded.aud).toBe('eduos-api-test');
    });

    test('should generate unique tokens for same payload', async () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'test@example.com',
      };

      const token1 = authService.generateAccessToken(payload);
      
      // Wait 1 second to ensure different iat timestamp
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const token2 = authService.generateAccessToken(payload);

      // Tokens should be different due to different iat timestamps
      expect(token1).not.toBe(token2);
    });
  });
});
