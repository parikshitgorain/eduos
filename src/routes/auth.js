/**
 * EduOS Platform - Authentication Routes
 * 
 * OAuth2/OIDC authentication endpoints
 */

const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const rbacService = require('../services/rbacService');
const { query } = require('../config/database');

/**
 * OIDC Discovery Endpoint
 * GET /.well-known/openid-configuration
 */
router.get('/.well-known/openid-configuration', (req, res) => {
  const discoveryDoc = authService.getDiscoveryDocument();
  res.json(discoveryDoc);
});

/**
 * JWKS Endpoint
 * GET /.well-known/jwks.json
 */
router.get('/.well-known/jwks.json', (req, res) => {
  const jwks = authService.getJWKS();
  res.json(jwks);
});

/**
 * Email/Password Login
 * POST /api/v1/auth/login
 * 
 * Request body:
 * {
 *   "tenantId": "uuid",
 *   "email": "user@example.com",
 *   "password": "password123",
 *   "rememberMe": false,
 *   "captchaToken": "optional"
 * }
 */
router.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { tenantId, email, password, rememberMe, captchaToken } = req.body;
    
    // Validate required fields
    if (!tenantId || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: tenantId, email, and password are required'
      });
    }
    
    // TODO: Verify CAPTCHA if provided (after 3 failed attempts)
    if (captchaToken) {
      // CAPTCHA verification logic here
    }
    
    // Find user
    const userResult = await query(
      `SELECT user_id, tenant_id, email, password_hash, mfa_enabled, status, roles
       FROM users
       WHERE email = $1 AND tenant_id = $2`,
      [email, tenantId]
    );
    
    if (userResult.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    const user = userResult.rows[0];
    
    // Check user status
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active'
      });
    }
    
    // Verify password
    const bcrypt = require('bcrypt');
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordValid) {
      // TODO: Increment failed login counter for CAPTCHA
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Check if MFA is required
    if (user.mfa_enabled) {
      // Generate MFA session
      const crypto = require('crypto');
      const sessionId = crypto.randomUUID();
      
      // Store session in Redis with 5-minute expiry
      const redis = require('../config/redis');
      await redis.set(
        `mfa_session:${sessionId}`,
        JSON.stringify({ userId: user.user_id, tenantId: user.tenant_id }),
        'EX',
        300
      );
      
      // TODO: Send MFA code via email/SMS
      
      return res.json({
        success: true,
        requiresMFA: true,
        sessionId: sessionId
      });
    }
    
    // Generate JWT token
    const expiresIn = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60; // 30 days or 24 hours
    
    const token = authService.generateAccessToken({
      userId: user.user_id,
      tenantId: user.tenant_id,
      email: user.email,
      roles: user.roles,
      permissions: []
    }, expiresIn);
    
    // Log successful login
    await query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, event_type, event_action, actor_type, actor_id, resource_type, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        user.tenant_id,
        user.user_id,
        'user_login',
        'authentication',
        'login',
        'user',
        user.user_id,
        'authentication',
        JSON.stringify({ method: 'email_password', ip_address: req.ip })
      ]
    );
    
    res.json({
      success: true,
      requiresMFA: false,
      token: token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * MFA Verification
 * POST /api/v1/auth/mfa/verify
 * 
 * Request body:
 * {
 *   "sessionId": "uuid",
 *   "otp": "123456"
 * }
 */
router.post('/api/v1/auth/mfa/verify', async (req, res) => {
  try {
    const { sessionId, otp } = req.body;
    
    if (!sessionId || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: sessionId and otp are required'
      });
    }
    
    // Get session from Redis
    const redis = require('../config/redis');
    const sessionData = await redis.get(`mfa_session:${sessionId}`);
    
    if (!sessionData) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session'
      });
    }
    
    const session = JSON.parse(sessionData);
    
    // Verify OTP
    const mfaService = require('../services/mfaService');
    const valid = await mfaService.verifyTOTP(session.userId, otp);
    
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid verification code'
      });
    }
    
    // Delete session
    await redis.del(`mfa_session:${sessionId}`);
    
    // Get user info
    const userResult = await query(
      `SELECT user_id, tenant_id, email, roles FROM users WHERE user_id = $1`,
      [session.userId]
    );
    
    const user = userResult.rows[0];
    
    // Generate JWT token
    const token = authService.generateAccessToken({
      userId: user.user_id,
      tenantId: user.tenant_id,
      email: user.email,
      roles: user.roles,
      permissions: []
    });
    
    res.json({
      success: true,
      token: token
    });
    
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Forgot Password
 * POST /api/v1/auth/forgot-password
 * 
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "tenantId": "uuid" // optional
 * }
 */
router.post('/api/v1/auth/forgot-password', async (req, res) => {
  try {
    const { email, tenantId } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Find user (don't reveal if user exists)
    const userResult = await query(
      `SELECT user_id, tenant_id, email, first_name
       FROM users
       WHERE email = $1 ${tenantId ? 'AND tenant_id = $2' : ''}`,
      tenantId ? [email, tenantId] : [email]
    );
    
    if (userResult.rowCount > 0) {
      const user = userResult.rows[0];
      
      // Generate reset token
      const crypto = require('crypto');
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      // Store reset token
      await query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [user.user_id, resetToken, expiresAt]
      );
      
      // TODO: Send email with reset link
      console.log(`Password reset link: /reset-password?token=${resetToken}`);
    }
    
    // Always return success (don't reveal if user exists)
    res.json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.'
    });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * SSO Initiation (Frontend-compatible endpoint)
 * GET /api/v1/auth/sso/:provider
 * 
 * This is an alias for the existing OAuth2 endpoint to match frontend expectations
 */
router.get('/api/v1/auth/sso/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { tenantId, redirectUri } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'tenantId query parameter is required',
      });
    }

    // Validate provider
    if (!['google', 'microsoft'].includes(provider)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid provider. Supported providers: google, microsoft',
      });
    }

    // Verify tenant exists
    const tenantResult = await query(
      'SELECT tenant_id, name, status FROM tenants WHERE tenant_id = $1',
      [tenantId]
    );

    if (tenantResult.rowCount === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tenant not found',
      });
    }

    if (tenantResult.rows[0].status !== 'active') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Tenant is not active',
      });
    }

    // Generate authorization URL
    const { url, state } = authService.getAuthorizationUrl(provider, tenantId, redirectUri);

    // Return in frontend-expected format
    res.json({
      authorizationUrl: url,
      state: state,
      provider: provider,
    });
  } catch (error) {
    console.error('SSO initiation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

/**
 * Initiate OAuth2 login
 * GET /auth/:provider/login
 * 
 * Supported providers: google, microsoft
 */
router.get('/:provider/login', async (req, res) => {
  try {
    const { provider } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'tenant_id query parameter is required',
      });
    }

    // Validate provider
    if (!['google', 'microsoft'].includes(provider)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid provider. Supported providers: google, microsoft',
      });
    }

    // Verify tenant exists
    const tenantResult = await query(
      'SELECT tenant_id, name, status FROM tenants WHERE tenant_id = $1',
      [tenant_id]
    );

    if (tenantResult.rowCount === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tenant not found',
      });
    }

    if (tenantResult.rows[0].status !== 'active') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Tenant is not active',
      });
    }

    // Generate authorization URL
    const { url, state } = authService.getAuthorizationUrl(provider, tenant_id);

    // Store state in session or return to client
    res.json({
      authorization_url: url,
      state: state,
      provider: provider,
    });
  } catch (error) {
    console.error('OAuth2 login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

/**
 * OAuth2 callback endpoint
 * GET /auth/:provider/callback
 */
router.get('/:provider/callback', async (req, res) => {
  try {
    const { provider } = req.params;
    const { code, state, error, error_description } = req.query;

    // Handle OAuth2 errors
    if (error) {
      return res.status(400).json({
        error: 'OAuth2 Error',
        message: error_description || error,
      });
    }

    if (!code || !state) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing code or state parameter',
      });
    }

    // Exchange code for tokens
    const userInfo = await authService.handleCallback(provider, code, state);

    // Check if user exists in database
    let userResult = await query(
      `SELECT user_id, tenant_id, email, roles, status 
       FROM users 
       WHERE email = $1 AND tenant_id = $2`,
      [userInfo.email, userInfo.tenantId]
    );

    let userId;
    let roles = [];

    if (userResult.rowCount === 0) {
      // Create new user
      const insertResult = await query(
        `INSERT INTO users (tenant_id, email, first_name, last_name, auth_provider, auth_provider_id, status, roles)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING user_id, roles`,
        [
          userInfo.tenantId,
          userInfo.email,
          userInfo.givenName,
          userInfo.familyName,
          provider,
          userInfo.providerId,
          'active',
          ['user'], // Default role
        ]
      );
      userId = insertResult.rows[0].user_id;
      roles = insertResult.rows[0].roles;
    } else {
      // User exists
      if (userResult.rows[0].status !== 'active') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'User account is not active',
        });
      }

      userId = userResult.rows[0].user_id;
      roles = userResult.rows[0].roles;

      // Update last login
      await query(
        'UPDATE users SET last_login_at = NOW() WHERE user_id = $1',
        [userId]
      );
    }

    // Generate JWT tokens
    const accessToken = authService.generateAccessToken({
      userId: userId,
      tenantId: userInfo.tenantId,
      email: userInfo.email,
      roles: roles,
      permissions: [], // TODO: Load permissions based on roles
    });

    const refreshToken = authService.generateRefreshToken({
      userId: userId,
      tenantId: userInfo.tenantId,
    });

    // Log authentication event
    await query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, event_type, event_action, actor_type, actor_id, resource_type, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userInfo.tenantId,
        userId,
        'user_login',
        'authentication',
        'login',
        'user',
        userId,
        'authentication',
        JSON.stringify({
          provider: provider,
          method: 'oauth2',
          ip_address: req.ip,
        }),
      ]
    );

    // Return tokens
    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 3600, // 1 hour
      user: {
        user_id: userId,
        tenant_id: userInfo.tenantId,
        email: userInfo.email,
        name: userInfo.name,
        roles: roles,
      },
    });
  } catch (error) {
    console.error('OAuth2 callback error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

/**
 * Token refresh endpoint
 * POST /auth/token/refresh
 */
router.post('/token/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'refresh_token is required',
      });
    }

    // Refresh tokens
    const tokens = await authService.refreshAccessToken(refresh_token);

    res.json({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_in: tokens.expiresIn,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Unauthorized',
      message: error.message,
    });
  }
});

/**
 * Token verification endpoint
 * POST /auth/token/verify
 */
router.post('/token/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'token is required',
      });
    }

    const decoded = authService.verifyToken(token);

    res.json({
      valid: true,
      payload: decoded,
    });
  } catch (error) {
    res.status(401).json({
      valid: false,
      error: error.message,
    });
  }
});

/**
 * User info endpoint (OIDC standard)
 * GET /auth/userinfo
 */
router.get('/userinfo', async (req, res) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);

    // Fetch user info from database
    const userResult = await query(
      `SELECT user_id, tenant_id, email, first_name, last_name, roles, created_at
       FROM users
       WHERE user_id = $1 AND tenant_id = $2`,
      [decoded.sub, decoded.tenant_id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    const user = userResult.rows[0];

    res.json({
      sub: user.user_id,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      given_name: user.first_name,
      family_name: user.last_name,
      tenant_id: user.tenant_id,
      roles: user.roles,
      created_at: user.created_at,
    });
  } catch (error) {
    console.error('Userinfo error:', error);
    res.status(401).json({
      error: 'Unauthorized',
      message: error.message,
    });
  }
});

/**
 * Logout endpoint
 * POST /auth/logout
 */
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = authService.verifyToken(token);

      // Log logout event
      await query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, event_type, event_action, actor_type, actor_id, resource_type, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          decoded.tenant_id,
          decoded.sub,
          'user_logout',
          'authentication',
          'logout',
          'user',
          decoded.sub,
          'authentication',
          JSON.stringify({
            method: 'manual',
            ip_address: req.ip,
          }),
        ]
      );
    }

    res.json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    // Even if token verification fails, return success
    res.json({
      message: 'Logged out successfully',
    });
  }
});

/**
 * Get user permissions endpoint
 * GET /auth/permissions
 * 
 * Returns all permissions for the authenticated user including inherited permissions
 */
router.get('/permissions', async (req, res) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);

    // Get user permissions
    const permissions = await rbacService.getUserPermissions(decoded.sub, decoded.tenant_id);

    // Get user roles
    const roles = await rbacService.getUserRoles(decoded.sub, decoded.tenant_id);

    res.json({
      user_id: decoded.sub,
      tenant_id: decoded.tenant_id,
      roles: roles,
      permissions: permissions,
      hierarchy: {
        description: 'SuperAdmin → InstituteAdmin → CenterAdmin → Teacher → Student',
        levels: {
          0: 'SuperAdmin',
          1: 'InstituteAdmin',
          2: 'CenterAdmin',
          3: 'Teacher',
          4: 'Student',
        },
      },
    });
  } catch (error) {
    console.error('Permissions error:', error);
    res.status(401).json({
      error: 'Unauthorized',
      message: error.message,
    });
  }
});

/**
 * Get field-level permissions endpoint
 * GET /auth/permissions/fields/:resourceType
 * 
 * Returns field-level permissions for a specific resource type
 */
router.get('/permissions/fields/:resourceType', async (req, res) => {
  try {
    const { resourceType } = req.params;

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);

    // Get field permissions
    const fieldPermissions = await rbacService.getUserFieldPermissions(
      decoded.sub,
      decoded.tenant_id,
      resourceType
    );

    res.json({
      user_id: decoded.sub,
      tenant_id: decoded.tenant_id,
      resource_type: resourceType,
      field_permissions: fieldPermissions,
    });
  } catch (error) {
    console.error('Field permissions error:', error);
    res.status(401).json({
      error: 'Unauthorized',
      message: error.message,
    });
  }
});

module.exports = router;
