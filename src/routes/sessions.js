/**
 * Session Management Routes
 * 
 * Task: 1.3.3 - Build session management with Redis
 * 
 * Endpoints:
 * - GET /api/v1/sessions - Get current user's sessions
 * - GET /api/v1/sessions/:sessionId - Get specific session
 * - DELETE /api/v1/sessions/:sessionId - Revoke specific session
 * - DELETE /api/v1/sessions - Revoke all user sessions
 * - GET /api/v1/sessions/:sessionId/activity - Get session activity log
 */

const express = require('express');
const sessionService = require('../services/sessionService');

const router = express.Router();

/**
 * Middleware to extract user info from request
 * In production, this would come from JWT token verification
 */
const extractUserInfo = (req, res, next) => {
  // For testing, accept user info from headers
  req.user = {
    userId: req.headers['x-user-id'] || req.body?.userId,
    tenantId: req.headers['x-tenant-id'] || req.body?.tenantId,
    email: req.headers['x-user-email'] || req.body?.email,
    roles: req.headers['x-user-roles']?.split(',') || [],
    permissions: req.headers['x-user-permissions']?.split(',') || [],
    tier: req.headers['x-tenant-tier'] || 'basic',
  };

  if (!req.user.userId || !req.user.tenantId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'User authentication required',
    });
  }

  next();
};

/**
 * GET /api/v1/sessions
 * Get all active sessions for the current user
 */
router.get('/', extractUserInfo, async (req, res) => {
  try {
    const { userId, tenantId } = req.user;

    const sessions = await sessionService.getUserSessions(userId, tenantId);

    res.json({
      sessions: sessions.map(session => ({
        sessionId: session.sessionId,
        createdAt: session.createdAt,
        lastAccessedAt: session.lastAccessedAt,
        expiresAt: session.expiresAt,
        metadata: session.metadata,
      })),
      count: sessions.length,
    });
  } catch (error) {
    console.error('Error getting user sessions:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve sessions',
    });
  }
});

/**
 * GET /api/v1/sessions/:sessionId
 * Get specific session details
 */
router.get('/:sessionId', extractUserInfo, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId, tenantId } = req.user;

    const session = await sessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found',
      });
    }

    // Verify session belongs to user
    if (session.userId !== userId || session.tenantId !== tenantId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this session',
      });
    }

    res.json({
      session: {
        sessionId: session.sessionId,
        userId: session.userId,
        tenantId: session.tenantId,
        email: session.email,
        roles: session.roles,
        permissions: session.permissions,
        tier: session.tier,
        createdAt: session.createdAt,
        lastAccessedAt: session.lastAccessedAt,
        expiresAt: session.expiresAt,
        metadata: session.metadata,
      },
    });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve session',
    });
  }
});

/**
 * DELETE /api/v1/sessions/:sessionId
 * Revoke specific session (logout from specific device)
 */
router.delete('/:sessionId', extractUserInfo, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId, tenantId } = req.user;

    const session = await sessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found',
      });
    }

    // Verify session belongs to user
    if (session.userId !== userId || session.tenantId !== tenantId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this session',
      });
    }

    const revoked = await sessionService.revokeSession(sessionId, 'user_logout');

    if (revoked) {
      res.json({
        message: 'Session revoked successfully',
        sessionId: sessionId,
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to revoke session',
      });
    }
  } catch (error) {
    console.error('Error revoking session:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to revoke session',
    });
  }
});

/**
 * DELETE /api/v1/sessions
 * Revoke all user sessions (logout from all devices)
 */
router.delete('/', extractUserInfo, async (req, res) => {
  try {
    const { userId, tenantId } = req.user;

    const revokedCount = await sessionService.revokeAllUserSessions(
      userId,
      tenantId,
      'user_logout_all'
    );

    res.json({
      message: 'All sessions revoked successfully',
      revokedCount: revokedCount,
    });
  } catch (error) {
    console.error('Error revoking all sessions:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to revoke sessions',
    });
  }
});

/**
 * GET /api/v1/sessions/:sessionId/activity
 * Get session activity log
 */
router.get('/:sessionId/activity', extractUserInfo, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId, tenantId } = req.user;
    const limit = parseInt(req.query.limit) || 100;

    const session = await sessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found',
      });
    }

    // Verify session belongs to user
    if (session.userId !== userId || session.tenantId !== tenantId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this session',
      });
    }

    const activity = await sessionService.getSessionActivity(sessionId, limit);

    res.json({
      sessionId: sessionId,
      activity: activity,
      count: activity.length,
    });
  } catch (error) {
    console.error('Error getting session activity:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve session activity',
    });
  }
});

/**
 * POST /api/v1/sessions/revoke-security
 * Revoke all sessions for security event (admin only)
 */
router.post('/revoke-security', extractUserInfo, async (req, res) => {
  try {
    const { userId, tenantId, roles } = req.user;
    const { targetUserId, reason } = req.body;

    // Check if user has admin role
    if (!roles.includes('admin') && !roles.includes('superadmin')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
    }

    if (!targetUserId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'targetUserId is required',
      });
    }

    const revokedCount = await sessionService.revokeAllUserSessions(
      targetUserId,
      tenantId,
      reason || 'security_event'
    );

    res.json({
      message: 'User sessions revoked for security event',
      targetUserId: targetUserId,
      revokedCount: revokedCount,
      reason: reason || 'security_event',
    });
  } catch (error) {
    console.error('Error revoking sessions for security:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to revoke sessions',
    });
  }
});

module.exports = router;
