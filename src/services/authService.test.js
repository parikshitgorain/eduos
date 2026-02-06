/**
 * AuthService Tests
 * 
 * Comprehensive test coverage for OAuth2/OIDC authentication service
 */

const authService = require('./authService');
const sessionService = require('./sessionService');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Mock dependencies
jest.mock('./sessionService');
jest.mock('openid-client');
jest.mock('jsonwebtoken');
jest.mock('crypto');

describe('AuthService', () => {
  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-123';
  const mockEmail = 'test@example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset environment variables
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_ISSUER = 'test-issuer';
    process.env.JWT_AUDIENCE = 'test-audience';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
    
    // Reset authService state
    authService.clients = {};
    authService.codeVerifiers = new Map();
    authService.initialized = false;
  });

  describe('initialize', () => {
    it('should initialize Google OAuth2 client when credentials are provided', async () => {
      process.env.GOOGLE_CLIENT_ID = 'google-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
      process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/google/callback';

      const { Issuer } = require('openid-client');
      const mockGoogleIssuer = {
        Client: jest.fn().mockImplementation(() => ({
          client_id: 'google-client-id',
          client_secret: 'google-client-secret',
        })),
      };
      Issuer.discover = jest.fn().mockResolvedValue(mockGoogleIssuer);

      await authService.initialize();

      expect(Issuer.discover).toHaveBeenCalledWith('https://accounts.google.com');
      expect(authService.initialized).toBe(true);
    });

    it('should initialize Microsoft OAuth2 client when credentials are provided', async () => {
      process.env.MICROSOFT_CLIENT_ID = 'microsoft-client-id';
      process.env.MICROSOFT_CLIENT_SECRET = 'microsoft-client-secret';
      process.env.MICROSOFT_REDIRECT_URI = 'http://localhost:3000/auth/microsoft/callback';

      const { Issuer } = require('openid-client');
      const mockMicrosoftIssuer = {
        Client: jest.fn().mockImplementation(() => ({
          client_id: 'microsoft-client-id',
          client_secret: 'microsoft-client-secret',
        })),
      };
      Issuer.discover = jest.fn().mockResolvedValue(mockMicrosoftIssuer);

      await authService.initialize();

      expect(Issuer.discover).toHaveBeenCalledWith('https://login.microsoftonline.com/common/v2.0');
      expect(authService.initialized).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      authService.initialized = true;
      const { Issuer } = require('openid-client');
      Issuer.discover = jest.fn();

      await authService.initialize();

      expect(Issuer.discover).not.toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      process.env.GOOGLE_CLIENT_ID = 'google-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';

      const { Issuer } = require('openid-client');
      Issuer.discover = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(authService.initialize()).rejects.toThrow('Network error');
    });
  });

  describe('getAuthorizationUrl', () => {
    beforeEach(() => {
      const mockClient = {
        authorizationUrl: jest.fn().mockReturnValue('https://auth.example.com/oauth2/authorize?code_challenge=test'),
      };
      authService.clients.google = mockClient;
    });

    it('should generate authorization URL for Google', () => {
      const { generators } = require('openid-client');
      generators.codeVerifier = jest.fn().mockReturnValue('test-verifier');
      generators.codeChallenge = jest.fn().mockReturnValue('test-challenge');
      
      crypto.randomBytes = jest.fn().mockReturnValue(Buffer.from('random-bytes'));
      
      const result = authService.getAuthorizationUrl('google', mockTenantId);

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('state');
      expect(authService.clients.google.authorizationUrl).toHaveBeenCalledWith({
        scope: 'openid email profile',
        state: expect.any(String),
        code_challenge: 'test-challenge',
        code_challenge_method: 'S256',
      });
    });

    it('should generate authorization URL for Microsoft', () => {
      const mockClient = {
        authorizationUrl: jest.fn().mockReturnValue('https://auth.microsoft.com/oauth2/authorize'),
      };
      authService.clients.microsoft = mockClient;

      const { generators } = require('openid-client');
      generators.codeVerifier = jest.fn().mockReturnValue('test-verifier');
      generators.codeChallenge = jest.fn().mockReturnValue('test-challenge');
      
      crypto.randomBytes = jest.fn().mockReturnValue(Buffer.from('random-bytes'));

      const result = authService.getAuthorizationUrl('microsoft', mockTenantId);

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('state');
      expect(mockClient.authorizationUrl).toHaveBeenCalledWith({
        scope: 'openid email profile User.Read',
        state: expect.any(String),
        code_challenge: 'test-challenge',
        code_challenge_method: 'S256',
      });
    });

    it('should throw error for unconfigured provider', () => {
      expect(() => {
        authService.getAuthorizationUrl('invalid', mockTenantId);
      }).toThrow("OAuth2 provider 'invalid' not configured");
    });
  });

  describe('handleCallback', () => {
    const mockCode = 'auth-code-123';
    const mockState = 'state-123';

    beforeEach(() => {
      const mockClient = {
        callback: jest.fn().mockResolvedValue({
          claims: () => ({
            sub: 'provider-user-id',
            email: mockEmail,
            name: 'Test User',
            given_name: 'Test',
            family_name: 'User',
            picture: 'https://example.com/avatar.jpg',
          }),
          id_token: 'id-token',
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_at: Date.now() + 3600000,
        }),
        redirect_uris: ['http://localhost:3000/auth/google/callback'],
      };
      authService.clients.google = mockClient;
      authService.codeVerifiers.set(mockState, 'test-verifier');
    });

    it('should handle OAuth2 callback successfully', async () => {
      // Mock the extractTenantFromState method to return a valid tenant ID
      const originalExtractTenant = authService.extractTenantFromState;
      authService.extractTenantFromState = jest.fn().mockReturnValue(mockTenantId);

      const result = await authService.handleCallback('google', mockCode, mockState);

      expect(result).toEqual({
        provider: 'google',
        providerId: 'provider-user-id',
        email: mockEmail,
        name: 'Test User',
        givenName: 'Test',
        familyName: 'User',
        picture: 'https://example.com/avatar.jpg',
        tenantId: mockTenantId,
        idToken: 'id-token',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: expect.any(Number),
      });
      expect(authService.codeVerifiers.has(mockState)).toBe(false);

      // Restore original method
      authService.extractTenantFromState = originalExtractTenant;
    });

    it('should throw error for invalid state', async () => {
      await expect(
        authService.handleCallback('google', mockCode, 'invalid-state')
      ).rejects.toThrow('Invalid state parameter or session expired');
    });

    it('should throw error for unconfigured provider', async () => {
      await expect(
        authService.handleCallback('invalid', mockCode, mockState)
      ).rejects.toThrow("OAuth2 provider 'invalid' not configured");
    });

    it('should clean up code verifier on error', async () => {
      authService.clients.google.callback.mockRejectedValue(new Error('OAuth error'));

      await expect(
        authService.handleCallback('google', mockCode, mockState)
      ).rejects.toThrow('OAuth error');
      
      expect(authService.codeVerifiers.has(mockState)).toBe(false);
    });
  });

  describe('generateAccessToken', () => {
    it('should generate access token with HS256 when no private key', () => {
      jwt.sign = jest.fn().mockReturnValue('access-token');

      const payload = {
        userId: mockUserId,
        tenantId: mockTenantId,
        email: mockEmail,
        roles: ['user'],
        permissions: ['read:profile'],
      };

      const token = authService.generateAccessToken(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUserId,
          tenant_id: mockTenantId,
          email: mockEmail,
          roles: ['user'],
          permissions: ['read:profile'],
          type: 'access',
        }),
        'test-secret',
        expect.objectContaining({
          algorithm: 'HS256',
          expiresIn: '1h',
          issuer: 'test-issuer',
          audience: 'test-audience',
        })
      );
      expect(token).toBe('access-token');
    });

    it('should generate access token with RS256 when private key available', () => {
      process.env.JWT_PRIVATE_KEY = 'private-key';
      jwt.sign = jest.fn().mockReturnValue('rs256-token');

      const payload = {
        userId: mockUserId,
        tenantId: mockTenantId,
        email: mockEmail,
      };

      const token = authService.generateAccessToken(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        'private-key',
        expect.objectContaining({
          algorithm: 'RS256',
        })
      );
      expect(token).toBe('rs256-token');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token with HS256', () => {
      // Ensure no private key is set for this test
      delete process.env.JWT_PRIVATE_KEY;
      jwt.sign = jest.fn().mockReturnValue('refresh-token');

      const payload = {
        userId: mockUserId,
        tenantId: mockTenantId,
      };

      const token = authService.generateRefreshToken(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUserId,
          tenant_id: mockTenantId,
          type: 'refresh',
        }),
        'test-secret',
        expect.objectContaining({
          algorithm: 'HS256',
          expiresIn: '7d',
        })
      );
      expect(token).toBe('refresh-token');
    });

    it('should generate refresh token with RS256 when private key available', () => {
      process.env.JWT_PRIVATE_KEY = 'private-key';
      jwt.sign = jest.fn().mockReturnValue('rs256-refresh-token');

      const payload = {
        userId: mockUserId,
        tenantId: mockTenantId,
      };

      const token = authService.generateRefreshToken(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        'private-key',
        expect.objectContaining({
          algorithm: 'RS256',
        })
      );
      expect(token).toBe('rs256-refresh-token');
    });
  });

  describe('verifyToken', () => {
    it('should verify token with HS256', () => {
      const mockDecoded = { sub: mockUserId, tenant_id: mockTenantId };
      jwt.verify = jest.fn().mockReturnValue(mockDecoded);

      const result = authService.verifyToken('test-token');

      expect(jwt.verify).toHaveBeenCalledWith(
        'test-token',
        'test-secret',
        expect.objectContaining({
          algorithms: ['HS256'],
          issuer: 'test-issuer',
          audience: 'test-audience',
        })
      );
      expect(result).toEqual(mockDecoded);
    });

    it('should verify token with RS256 when public key available', () => {
      process.env.JWT_PUBLIC_KEY = 'public-key';
      const mockDecoded = { sub: mockUserId, tenant_id: mockTenantId };
      jwt.verify = jest.fn().mockReturnValue(mockDecoded);

      const result = authService.verifyToken('test-token');

      expect(jwt.verify).toHaveBeenCalledWith(
        'test-token',
        'public-key',
        expect.objectContaining({
          algorithms: ['RS256'],
        })
      );
      expect(result).toEqual(mockDecoded);
    });

    it('should throw error for invalid token', () => {
      jwt.verify = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => {
        authService.verifyToken('invalid-token');
      }).toThrow('Token verification failed: Invalid token');
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token successfully', async () => {
      const mockDecoded = {
        type: 'refresh',
        sub: mockUserId,
        tenant_id: mockTenantId,
        email: mockEmail,
        roles: ['user'],
        permissions: ['read:profile'],
      };
      
      jwt.verify = jest.fn().mockReturnValue(mockDecoded);
      jwt.sign = jest.fn()
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await authService.refreshAccessToken('refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
      });
    });

    it('should throw error for invalid token type', async () => {
      jwt.verify = jest.fn().mockReturnValue({ type: 'access' });

      await expect(
        authService.refreshAccessToken('access-token')
      ).rejects.toThrow('Token refresh failed: Invalid token type');
    });

    it('should handle verification errors', async () => {
      jwt.verify = jest.fn().mockImplementation(() => {
        throw new Error('Token expired');
      });

      await expect(
        authService.refreshAccessToken('expired-token')
      ).rejects.toThrow('Token refresh failed: Token verification failed: Token expired');
    });
  });

  describe('generateState', () => {
    it('should generate state with tenant context', () => {
      crypto.randomBytes = jest.fn().mockReturnValue(Buffer.from('random-bytes'));

      const state = authService.generateState(mockTenantId);

      expect(crypto.randomBytes).toHaveBeenCalledWith(16);
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(0);
    });
  });

  describe('extractTenantFromState', () => {
    it('should extract tenant ID from valid state', () => {
      const stateData = {
        random: 'random-bytes',
        tenant_id: mockTenantId,
        timestamp: Date.now(),
      };
      const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

      const tenantId = authService.extractTenantFromState(state);

      expect(tenantId).toBe(mockTenantId);
    });

    it('should throw error for invalid state', () => {
      expect(() => {
        authService.extractTenantFromState('invalid-state');
      }).toThrow('Invalid state parameter');
    });
  });

  describe('getDiscoveryDocument', () => {
    it('should return OIDC discovery document', () => {
      process.env.BASE_URL = 'https://api.example.com';

      const doc = authService.getDiscoveryDocument();

      expect(doc).toEqual({
        issuer: 'test-issuer',
        authorization_endpoint: 'https://api.example.com/auth/authorize',
        token_endpoint: 'https://api.example.com/auth/token',
        userinfo_endpoint: 'https://api.example.com/auth/userinfo',
        jwks_uri: 'https://api.example.com/.well-known/jwks.json',
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256', 'HS256'],
        scopes_supported: ['openid', 'email', 'profile'],
        token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
        claims_supported: ['sub', 'email', 'name', 'given_name', 'family_name', 'tenant_id', 'roles', 'permissions'],
        code_challenge_methods_supported: ['S256'],
      });
    });

    it('should use default base URL when not provided', () => {
      delete process.env.BASE_URL;

      const doc = authService.getDiscoveryDocument();

      expect(doc.authorization_endpoint).toBe('http://localhost:3000/auth/authorize');
    });
  });

  describe('getJWKS', () => {
    it('should return empty JWKS when no public key', () => {
      delete process.env.JWT_PUBLIC_KEY;

      const jwks = authService.getJWKS();

      expect(jwks).toEqual({ keys: [] });
    });

    it('should return JWKS with key when public key available', () => {
      process.env.JWT_PUBLIC_KEY = 'public-key';

      const jwks = authService.getJWKS();

      expect(jwks.keys).toHaveLength(1);
      expect(jwks.keys[0]).toEqual({
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256',
        kid: 'eduos-key-1',
      });
    });
  });

  describe('createAuthSession', () => {
    it('should create session with user data', async () => {
      const mockSession = { sessionId: 'session-123' };
      sessionService.createSession.mockResolvedValue(mockSession);

      const userData = {
        userId: mockUserId,
        tenantId: mockTenantId,
        email: mockEmail,
        roles: ['user'],
        permissions: ['read:profile'],
        tier: 'premium',
      };
      const metadata = { ip: '127.0.0.1', userAgent: 'test-agent' };

      const result = await authService.createAuthSession(userData, metadata);

      expect(sessionService.createSession).toHaveBeenCalledWith({
        userId: mockUserId,
        tenantId: mockTenantId,
        email: mockEmail,
        roles: ['user'],
        permissions: ['read:profile'],
        tier: 'premium',
        metadata,
      });
      expect(result).toEqual(mockSession);
    });

    it('should use default values for optional fields', async () => {
      const mockSession = { sessionId: 'session-123' };
      sessionService.createSession.mockResolvedValue(mockSession);

      const userData = {
        userId: mockUserId,
        tenantId: mockTenantId,
        email: mockEmail,
      };

      await authService.createAuthSession(userData);

      expect(sessionService.createSession).toHaveBeenCalledWith({
        userId: mockUserId,
        tenantId: mockTenantId,
        email: mockEmail,
        roles: [],
        permissions: [],
        tier: 'basic',
        metadata: {},
      });
    });
  });

  describe('logout', () => {
    it('should revoke session', async () => {
      sessionService.revokeSession.mockResolvedValue(true);

      const result = await authService.logout('session-123');

      expect(sessionService.revokeSession).toHaveBeenCalledWith('session-123', 'user_logout');
      expect(result).toBe(true);
    });
  });

  describe('logoutAll', () => {
    it('should revoke all user sessions', async () => {
      sessionService.revokeAllUserSessions.mockResolvedValue(3);

      const result = await authService.logoutAll(mockUserId, mockTenantId);

      expect(sessionService.revokeAllUserSessions).toHaveBeenCalledWith(
        mockUserId,
        mockTenantId,
        'user_logout_all'
      );
      expect(result).toBe(3);
    });
  });

  describe('validateSession', () => {
    it('should validate and touch session', async () => {
      const mockSession = { sessionId: 'session-123', userId: mockUserId };
      sessionService.getSession.mockResolvedValue(mockSession);
      sessionService.touchSession.mockResolvedValue(mockSession);

      const result = await authService.validateSession('session-123');

      expect(sessionService.getSession).toHaveBeenCalledWith('session-123');
      expect(sessionService.touchSession).toHaveBeenCalledWith('session-123');
      expect(result).toEqual(mockSession);
    });

    it('should return null for invalid session', async () => {
      sessionService.getSession.mockResolvedValue(null);

      const result = await authService.validateSession('invalid-session');

      expect(sessionService.getSession).toHaveBeenCalledWith('invalid-session');
      expect(sessionService.touchSession).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
});