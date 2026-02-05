/**
 * EduOS Platform - Authentication Service
 * 
 * OAuth2/OIDC authentication service with JWT token generation
 * Supports Google and Microsoft SSO providers
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Issuer, generators } = require('openid-client');

class AuthService {
  constructor() {
    this.clients = {};
    this.codeVerifiers = new Map(); // Store PKCE code verifiers
    this.initialized = false;
  }

  /**
   * Initialize OAuth2/OIDC clients for configured providers
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize Google OAuth2 client
      if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        const googleIssuer = await Issuer.discover('https://accounts.google.com');
        this.clients.google = new googleIssuer.Client({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uris: [process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'],
          response_types: ['code'],
        });
        console.log('Google OAuth2 client initialized');
      }

      // Initialize Microsoft OAuth2 client
      if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
        const microsoftIssuer = await Issuer.discover('https://login.microsoftonline.com/common/v2.0');
        this.clients.microsoft = new microsoftIssuer.Client({
          client_id: process.env.MICROSOFT_CLIENT_ID,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET,
          redirect_uris: [process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/auth/microsoft/callback'],
          response_types: ['code'],
        });
        console.log('Microsoft OAuth2 client initialized');
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize OAuth2 clients:', error);
      throw error;
    }
  }

  /**
   * Generate authorization URL for OAuth2 flow
   * @param {string} provider - 'google' or 'microsoft'
   * @param {string} tenantId - Tenant ID for multi-tenant context
   * @returns {Object} Authorization URL and state
   */
  getAuthorizationUrl(provider, tenantId) {
    const client = this.clients[provider];
    if (!client) {
      throw new Error(`OAuth2 provider '${provider}' not configured`);
    }

    // Generate PKCE code verifier and challenge
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    // Generate state parameter with tenant context
    const state = this.generateState(tenantId);

    // Store code verifier for later use
    this.codeVerifiers.set(state, codeVerifier);

    // Generate authorization URL
    const authUrl = client.authorizationUrl({
      scope: provider === 'google' 
        ? 'openid email profile' 
        : 'openid email profile User.Read',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return {
      url: authUrl,
      state: state,
    };
  }

  /**
   * Handle OAuth2 callback and exchange code for tokens
   * @param {string} provider - 'google' or 'microsoft'
   * @param {string} code - Authorization code
   * @param {string} state - State parameter
   * @returns {Object} User info and tokens
   */
  async handleCallback(provider, code, state) {
    const client = this.clients[provider];
    if (!client) {
      throw new Error(`OAuth2 provider '${provider}' not configured`);
    }

    // Retrieve code verifier
    const codeVerifier = this.codeVerifiers.get(state);
    if (!codeVerifier) {
      throw new Error('Invalid state parameter or session expired');
    }

    try {
      // Exchange authorization code for tokens
      const tokenSet = await client.callback(
        client.redirect_uris[0],
        { code, state },
        { code_verifier: codeVerifier, state }
      );

      // Get user info from ID token
      const claims = tokenSet.claims();

      // Clean up code verifier
      this.codeVerifiers.delete(state);

      // Extract tenant ID from state
      const tenantId = this.extractTenantFromState(state);

      return {
        provider: provider,
        providerId: claims.sub,
        email: claims.email,
        name: claims.name,
        givenName: claims.given_name,
        familyName: claims.family_name,
        picture: claims.picture,
        tenantId: tenantId,
        idToken: tokenSet.id_token,
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token,
        expiresAt: tokenSet.expires_at,
      };
    } catch (error) {
      this.codeVerifiers.delete(state);
      throw error;
    }
  }

  /**
   * Generate JWT access token with RS256 signing
   * @param {Object} payload - Token payload
   * @returns {string} JWT token
   */
  generateAccessToken(payload) {
    const {
      userId,
      tenantId,
      email,
      roles = [],
      permissions = [],
    } = payload;

    const tokenPayload = {
      sub: userId,
      tenant_id: tenantId,
      email: email,
      roles: roles,
      permissions: permissions,
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
    };

    // Use RS256 if private key is available, otherwise HS256
    const privateKey = process.env.JWT_PRIVATE_KEY;
    const secret = process.env.JWT_SECRET;

    if (privateKey) {
      return jwt.sign(tokenPayload, privateKey, {
        algorithm: 'RS256',
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        issuer: process.env.JWT_ISSUER || 'eduos-platform',
        audience: process.env.JWT_AUDIENCE || 'eduos-api',
      });
    } else {
      // Fallback to HS256 for development
      return jwt.sign(tokenPayload, secret, {
        algorithm: 'HS256',
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        issuer: process.env.JWT_ISSUER || 'eduos-platform',
        audience: process.env.JWT_AUDIENCE || 'eduos-api',
      });
    }
  }

  /**
   * Generate JWT refresh token
   * @param {Object} payload - Token payload
   * @returns {string} JWT refresh token
   */
  generateRefreshToken(payload) {
    const {
      userId,
      tenantId,
    } = payload;

    const tokenPayload = {
      sub: userId,
      tenant_id: tenantId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
    };

    const privateKey = process.env.JWT_PRIVATE_KEY;
    const secret = process.env.JWT_SECRET;

    if (privateKey) {
      return jwt.sign(tokenPayload, privateKey, {
        algorithm: 'RS256',
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        issuer: process.env.JWT_ISSUER || 'eduos-platform',
        audience: process.env.JWT_AUDIENCE || 'eduos-api',
      });
    } else {
      return jwt.sign(tokenPayload, secret, {
        algorithm: 'HS256',
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        issuer: process.env.JWT_ISSUER || 'eduos-platform',
        audience: process.env.JWT_AUDIENCE || 'eduos-api',
      });
    }
  }

  /**
   * Verify and decode JWT token
   * @param {string} token - JWT token
   * @returns {Object} Decoded token payload
   */
  verifyToken(token) {
    const publicKey = process.env.JWT_PUBLIC_KEY;
    const secret = process.env.JWT_SECRET;

    try {
      if (publicKey) {
        return jwt.verify(token, publicKey, {
          algorithms: ['RS256'],
          issuer: process.env.JWT_ISSUER || 'eduos-platform',
          audience: process.env.JWT_AUDIENCE || 'eduos-api',
        });
      } else {
        return jwt.verify(token, secret, {
          algorithms: ['HS256'],
          issuer: process.env.JWT_ISSUER || 'eduos-platform',
          audience: process.env.JWT_AUDIENCE || 'eduos-api',
        });
      }
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Object} New access token and refresh token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const decoded = this.verifyToken(refreshToken);

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Generate new access token
      const accessToken = this.generateAccessToken({
        userId: decoded.sub,
        tenantId: decoded.tenant_id,
        email: decoded.email,
        roles: decoded.roles,
        permissions: decoded.permissions,
      });

      // Generate new refresh token
      const newRefreshToken = this.generateRefreshToken({
        userId: decoded.sub,
        tenantId: decoded.tenant_id,
      });

      return {
        accessToken: accessToken,
        refreshToken: newRefreshToken,
        expiresIn: 3600, // 1 hour
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Generate state parameter with tenant context
   * @param {string} tenantId - Tenant ID
   * @returns {string} State parameter
   */
  generateState(tenantId) {
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const state = Buffer.from(JSON.stringify({
      random: randomBytes,
      tenant_id: tenantId,
      timestamp: Date.now(),
    })).toString('base64url');
    return state;
  }

  /**
   * Extract tenant ID from state parameter
   * @param {string} state - State parameter
   * @returns {string} Tenant ID
   */
  extractTenantFromState(state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
      return decoded.tenant_id;
    } catch (error) {
      throw new Error('Invalid state parameter');
    }
  }

  /**
   * Get OIDC discovery document
   * @returns {Object} OIDC discovery document
   */
  getDiscoveryDocument() {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    return {
      issuer: process.env.JWT_ISSUER || 'eduos-platform',
      authorization_endpoint: `${baseUrl}/auth/authorize`,
      token_endpoint: `${baseUrl}/auth/token`,
      userinfo_endpoint: `${baseUrl}/auth/userinfo`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256', 'HS256'],
      scopes_supported: ['openid', 'email', 'profile'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
      claims_supported: ['sub', 'email', 'name', 'given_name', 'family_name', 'tenant_id', 'roles', 'permissions'],
      code_challenge_methods_supported: ['S256'],
    };
  }

  /**
   * Get JWKS (JSON Web Key Set) for token verification
   * @returns {Object} JWKS document
   */
  getJWKS() {
    const publicKey = process.env.JWT_PUBLIC_KEY;

    if (!publicKey) {
      return {
        keys: [],
      };
    }

    // Convert PEM public key to JWK format
    // This is a simplified version - in production, use a library like node-jose
    return {
      keys: [
        {
          kty: 'RSA',
          use: 'sig',
          alg: 'RS256',
          kid: 'eduos-key-1',
          // In production, properly convert PEM to JWK
          // For now, return empty to indicate RS256 is supported
        },
      ],
    };
  }
}

// Export singleton instance
const authService = new AuthService();

module.exports = authService;
