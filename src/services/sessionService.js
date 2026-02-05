/**
 * EduOS Platform - Session Management Service
 * 
 * Task: 1.3.3 - Build session management with Redis
 * 
 * Features:
 * - User sessions stored in Redis with sliding expiration
 * - Session includes: user_id, tenant_id, roles, permissions
 * - Concurrent session limit enforcement (configurable per tier)
 * - Session revocation API for logout and security events
 * - Session activity tracking for audit logs
 */

const crypto = require('crypto');
const { redis } = require('../config/redis');

// Session configuration by tier
const SESSION_CONFIG = {
  basic: {
    maxConcurrentSessions: 2,
    slidingExpiration: 3600, // 1 hour in seconds
    absoluteExpiration: 86400, // 24 hours in seconds
  },
  business: {
    maxConcurrentSessions: 5,
    slidingExpiration: 7200, // 2 hours in seconds
    absoluteExpiration: 172800, // 48 hours in seconds
  },
  enterprise: {
    maxConcurrentSessions: 10,
    slidingExpiration: 14400, // 4 hours in seconds
    absoluteExpiration: 604800, // 7 days in seconds
  },
};

class SessionService {
  constructor() {
    this.redisClient = redis;
  }

  /**
   * Generate a unique session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a new session
   * @param {Object} sessionData - Session data
   * @param {string} sessionData.userId - User ID
   * @param {string} sessionData.tenantId - Tenant ID
   * @param {string} sessionData.email - User email
   * @param {Array<string>} sessionData.roles - User roles
   * @param {Array<string>} sessionData.permissions - User permissions
   * @param {string} sessionData.tier - Tenant tier (basic, business, enterprise)
   * @param {Object} sessionData.metadata - Additional metadata (IP, user agent, etc.)
   * @returns {Promise<Object>} Session object with sessionId
   */
  async createSession(sessionData) {
    const {
      userId,
      tenantId,
      email,
      roles = [],
      permissions = [],
      tier = 'basic',
      metadata = {},
    } = sessionData;

    // Validate required fields
    if (!userId || !tenantId) {
      throw new Error('userId and tenantId are required');
    }

    // Get tier configuration
    const config = SESSION_CONFIG[tier] || SESSION_CONFIG.basic;

    // Check concurrent session limit
    const existingSessions = await this.getUserSessions(userId, tenantId);
    if (existingSessions.length >= config.maxConcurrentSessions) {
      // Remove oldest session to make room
      const oldestSession = existingSessions[0];
      await this.revokeSession(oldestSession.sessionId);
    }

    // Generate session ID
    const sessionId = this.generateSessionId();

    // Create session object
    const session = {
      sessionId,
      userId,
      tenantId,
      email,
      roles,
      permissions,
      tier,
      metadata,
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + config.absoluteExpiration * 1000).toISOString(),
    };

    // Store session in Redis
    const sessionKey = this.getSessionKey(sessionId);
    await this.redisClient.setex(
      sessionKey,
      config.slidingExpiration,
      JSON.stringify(session)
    );

    // Add session to user's session list
    const userSessionsKey = this.getUserSessionsKey(userId, tenantId);
    await this.redisClient.zadd(
      userSessionsKey,
      Date.now(),
      sessionId
    );

    // Set expiration on user sessions list
    await this.redisClient.expire(userSessionsKey, config.absoluteExpiration);

    // Log session creation for audit
    await this.logSessionActivity(sessionId, 'session_created', {
      userId,
      tenantId,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
    });

    return session;
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session object or null if not found
   */
  async getSession(sessionId) {
    const sessionKey = this.getSessionKey(sessionId);
    const sessionData = await this.redisClient.get(sessionKey);

    if (!sessionData) {
      return null;
    }

    const session = JSON.parse(sessionData);

    // Check if session has expired (absolute expiration)
    if (new Date(session.expiresAt) < new Date()) {
      await this.revokeSession(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Update session with sliding expiration
   * @param {string} sessionId - Session ID
   * @param {Object} updates - Optional updates to session data
   * @returns {Promise<Object|null>} Updated session or null if not found
   */
  async touchSession(sessionId, updates = {}) {
    const session = await this.getSession(sessionId);

    if (!session) {
      return null;
    }

    // Update last accessed time
    session.lastAccessedAt = new Date().toISOString();

    // Apply any updates
    Object.assign(session, updates);

    // Get tier configuration
    const config = SESSION_CONFIG[session.tier] || SESSION_CONFIG.basic;

    // Update session in Redis with sliding expiration
    const sessionKey = this.getSessionKey(sessionId);
    await this.redisClient.setex(
      sessionKey,
      config.slidingExpiration,
      JSON.stringify(session)
    );

    // Log session activity
    await this.logSessionActivity(sessionId, 'session_accessed', {
      userId: session.userId,
      tenantId: session.tenantId,
    });

    return session;
  }

  /**
   * Revoke a session (logout)
   * @param {string} sessionId - Session ID
   * @param {string} reason - Reason for revocation
   * @returns {Promise<boolean>} True if session was revoked
   */
  async revokeSession(sessionId, reason = 'user_logout') {
    const session = await this.getSession(sessionId);

    if (!session) {
      return false;
    }

    // Remove session from Redis
    const sessionKey = this.getSessionKey(sessionId);
    await this.redisClient.del(sessionKey);

    // Remove from user's session list
    const userSessionsKey = this.getUserSessionsKey(session.userId, session.tenantId);
    await this.redisClient.zrem(userSessionsKey, sessionId);

    // Log session revocation for audit
    await this.logSessionActivity(sessionId, 'session_revoked', {
      userId: session.userId,
      tenantId: session.tenantId,
      reason,
    });

    return true;
  }

  /**
   * Revoke all sessions for a user
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @param {string} reason - Reason for revocation
   * @returns {Promise<number>} Number of sessions revoked
   */
  async revokeAllUserSessions(userId, tenantId, reason = 'security_event') {
    const sessions = await this.getUserSessions(userId, tenantId);

    let revokedCount = 0;
    for (const session of sessions) {
      const revoked = await this.revokeSession(session.sessionId, reason);
      if (revoked) {
        revokedCount++;
      }
    }

    return revokedCount;
  }

  /**
   * Get all active sessions for a user
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Array<Object>>} Array of session objects
   */
  async getUserSessions(userId, tenantId) {
    const userSessionsKey = this.getUserSessionsKey(userId, tenantId);
    const sessionIds = await this.redisClient.zrange(userSessionsKey, 0, -1);

    const sessions = [];
    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    // Sort by creation time (oldest first)
    sessions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return sessions;
  }

  /**
   * Get session count for a user
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<number>} Number of active sessions
   */
  async getUserSessionCount(userId, tenantId) {
    const sessions = await this.getUserSessions(userId, tenantId);
    return sessions.length;
  }

  /**
   * Update session permissions (for RBAC changes)
   * @param {string} sessionId - Session ID
   * @param {Array<string>} roles - Updated roles
   * @param {Array<string>} permissions - Updated permissions
   * @returns {Promise<Object|null>} Updated session or null if not found
   */
  async updateSessionPermissions(sessionId, roles, permissions) {
    return await this.touchSession(sessionId, { roles, permissions });
  }

  /**
   * Log session activity for audit trail
   * @param {string} sessionId - Session ID
   * @param {string} action - Action type
   * @param {Object} details - Additional details
   * @returns {Promise<void>}
   */
  async logSessionActivity(sessionId, action, details = {}) {
    const logKey = this.getSessionActivityKey(sessionId);
    const logEntry = {
      action,
      timestamp: new Date().toISOString(),
      ...details,
    };

    // Store activity log in Redis list (limited to last 100 entries)
    await this.redisClient.lpush(logKey, JSON.stringify(logEntry));
    await this.redisClient.ltrim(logKey, 0, 99);

    // Set expiration on activity log (30 days)
    await this.redisClient.expire(logKey, 2592000);
  }

  /**
   * Get session activity log
   * @param {string} sessionId - Session ID
   * @param {number} limit - Maximum number of entries to return
   * @returns {Promise<Array<Object>>} Array of activity log entries
   */
  async getSessionActivity(sessionId, limit = 100) {
    const logKey = this.getSessionActivityKey(sessionId);
    const logs = await this.redisClient.lrange(logKey, 0, limit - 1);

    return logs.map(log => JSON.parse(log));
  }

  /**
   * Clean up expired sessions (maintenance task)
   * @returns {Promise<number>} Number of sessions cleaned up
   */
  async cleanupExpiredSessions() {
    // This is a maintenance task that should be run periodically
    // Redis TTL will handle most cleanup, but this ensures consistency
    let cleanedCount = 0;

    // Get all user session keys
    const pattern = 'session:user:*:sessions';
    const keys = await this.redisClient.keys(pattern);

    for (const key of keys) {
      const sessionIds = await this.redisClient.zrange(key, 0, -1);

      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (!session) {
          // Session doesn't exist, remove from user's session list
          await this.redisClient.zrem(key, sessionId);
          cleanedCount++;
        }
      }
    }

    return cleanedCount;
  }

  /**
   * Get Redis key for session
   * @param {string} sessionId - Session ID
   * @returns {string} Redis key
   */
  getSessionKey(sessionId) {
    return `session:${sessionId}`;
  }

  /**
   * Get Redis key for user sessions list
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @returns {string} Redis key
   */
  getUserSessionsKey(userId, tenantId) {
    return `session:user:${tenantId}:${userId}:sessions`;
  }

  /**
   * Get Redis key for session activity log
   * @param {string} sessionId - Session ID
   * @returns {string} Redis key
   */
  getSessionActivityKey(sessionId) {
    return `session:${sessionId}:activity`;
  }

  /**
   * Get session configuration for a tier
   * @param {string} tier - Tier name (basic, business, enterprise)
   * @returns {Object} Session configuration
   */
  getSessionConfig(tier) {
    return SESSION_CONFIG[tier] || SESSION_CONFIG.basic;
  }
}

// Export singleton instance
const sessionService = new SessionService();

module.exports = sessionService;
