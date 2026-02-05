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
