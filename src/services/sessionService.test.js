/**
 * Session Service Tests
 * 
 * Task: 1.3.3 - Build session management with Redis
 * 
 * Tests:
 * - Session creation with sliding expiration
 * - Session retrieval and updates
 * - Concurrent session limit enforcement
 * - Session revocation (logout)
 * - Session activity tracking
 * - Multi-tier configuration
 */

const sessionService = require('./sessionService');
const { redis } = require('../config/redis');

describe('SessionService', () => {
  // Clean up Redis before and after tests
  beforeEach(async () => {
    await redis.flushdb();
  });

  afterAll(async () => {
    await redis.flushdb();
    await redis.quit();
  });

  describe('Session Creation', () => {
    test('should create a new session with required fields', async () => {
      const sessionData = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'user@example.com',
        roles: ['teacher'],
        permissions: ['read:students', 'write:attendance'],
        tier: 'basic',
        metadata: {
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      };

      const session = await sessionService.createSession(sessionData);

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.userId).toBe('user-123');
      expect(session.tenantId).toBe('tenant-456');
      expect(session.email).toBe('user@example.com');
      expect(session.roles).toEqual(['teacher']);
      expect(session.permissions).toEqual(['read:students', 'write:attendance']);
      expect(session.tier).toBe('basic');
      expect(session.createdAt).toBeDefined();
      expect(session.lastAccessedAt).toBeDefined();
      expect(session.expiresAt).toBeDefined();
    });

    test('should throw error if userId is missing', async () => {
      const sessionData = {
        tenantId: 'tenant-456',
        email: 'user@example.com',
      };

      await expect(sessionService.createSession(sessionData)).rejects.toThrow(
        'userId and tenantId are required'
      );
    });

    test('should throw error if tenantId is missing', async () => {
      const sessionData = {
        userId: 'user-123',
        email: 'user@example.com',
      };

      await expect(sessionService.createSession(sessionData)).rejects.toThrow(
        'userId and tenantId are required'
      );
    });

    test('should use default tier if not specified', async () => {
      const sessionData = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'user@example.com',
      };

      const session = await sessionService.createSession(sessionData);

      expect(session.tier).toBe('basic');
    });

    test('should log session creation activity', async () => {
      const sessionData = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'user@example.com',
        metadata: {
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      };

      const session = await sessionService.createSession(sessionData);
      const activity = await sessionService.getSessionActivity(session.sessionId);

      expect(activity).toHaveLength(1);
      expect(activity[0].action).toBe('session_created');
      expect(activity[0].userId).toBe('user-123');
      expect(activity[0].tenantId).toBe('tenant-456');
    });
  });

  describe('Session Retrieval', () => {
    test('should retrieve an existing session', async () => {
      const sessionData = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'user@example.com',
      };

      const createdSession = await sessionService.createSession(sessionData);
      const retrievedSession = await sessionService.getSession(createdSession.sessionId);

      expect(retrievedSession).toBeDefined();
      expect(retrievedSession.sessionId).toBe(createdSession.sessionId);
      expect(retrievedSession.userId).toBe('user-123');
    });

    test('should return null for non-existent session', async () => {
      const session = await sessionService.getSession('non-existent-session-id');

      expect(session).toBeNull();
    });
  });

  describe('Session Touch (Sliding Expiration)', () => {
    test('should update lastAccessedAt when touching session', async () => {
      const sessionData = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'user@example.com',
      };

      const session = await sessionService.createSession(sessionData);
      const originalLastAccessed = session.lastAccessedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const touchedSession = await sessionService.touchSession(session.sessionId);

      expect(touchedSession).toBeDefined();
      expect(touchedSession.lastAccessedAt).not.toBe(originalLastAccessed);
      expect(new Date(touchedSession.lastAccessedAt).getTime()).toBeGreaterThan(
        new Date(originalLastAccessed).getTime()
      );
    });

    test('should apply updates when touching session', async () => {
      const sessionData = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'user@example.com',
        roles: ['teacher'],
      };

      const session = await sessionService.createSession(sessionData);
      const updates = {
        roles: ['teacher', 'admin'],
        permissions: ['read:all', 'write:all'],
      };

      const touchedSession = await sessionService.touchSession(session.sessionId, updates);

      expect(touchedSession.roles).toEqual(['teacher', 'admin']);
      expect(touchedSession.permissions).toEqual(['read:all', 'write:all']);
    });

    test('should log session access activity', async () => {
      const sessionData = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'user@example.com',
      };

      const session = await sessionService.createSession(sessionData);
      await sessionService.touchSession(session.sessionId);

      const activity = await sessionService.getSessionActivity(session.sessionId);

      expect(activity.length).toBeGreaterThanOrEqual(2);
      expect(activity[0].action).toBe('session_accessed');
    });

    test('should return null when touching non-existent session', async () => {
      const result = await sessionService.touchSession('non-existent-session-id');

      expect(result).toBeNull();
    });
  });

  describe('Session Revocation', () => {
    test('should revoke a session', async () => {
      const sessionData = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'user@example.com',
      };

      const session = await sessionService.createSession(sessionData);
      const revoked = await sessionService.revokeSession(session.sessionId);

      expect(revoked).toBe(true);

      const retrievedSession = await sessionService.getSession(session.sessionId);
      expect(retrievedSession).toBeNull();
    });

    test('should log session revocation activity', async () => {
      const sessionData = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'user@example.com',
      };

      const session = await sessionService.createSession(sessionData);
      await sessionService.revokeSession(session.sessionId, 'user_logout');

      const activity = await sessionService.getSessionActivity(session.sessionId);

      const revocationLog = activity.find(log => log.action === 'session_revoked');
      expect(revocationLog).toBeDefined();
      expect(revocationLog.reason).toBe('user_logout');
    });

    test('should return false when revoking non-existent session', async () => {
      const revoked = await sessionService.revokeSession('non-existent-session-id');

      expect(revoked).toBe(false);
    });

    test('should revoke all user sessions', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';

      // Create multiple sessions (use business tier to allow more sessions)
      await sessionService.createSession({
        userId,
        tenantId,
        email: 'user@example.com',
        tier: 'business', // Allows 5 concurrent sessions
      });
      await sessionService.createSession({
        userId,
        tenantId,
        email: 'user@example.com',
        tier: 'business',
      });
      await sessionService.createSession({
        userId,
        tenantId,
        email: 'user@example.com',
        tier: 'business',
      });

      const revokedCount = await sessionService.revokeAllUserSessions(
        userId,
        tenantId,
        'security_event'
      );

      expect(revokedCount).toBe(3);

      const sessions = await sessionService.getUserSessions(userId, tenantId);
      expect(sessions).toHaveLength(0);
    });
  });

  describe('Concurrent Session Limits', () => {
    test('should enforce basic tier limit (2 sessions)', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';

      // Create 3 sessions (basic tier allows 2)
      const session1 = await sessionService.createSession({
        userId,
        tenantId,
        email: 'user@example.com',
        tier: 'basic',
      });

      const session2 = await sessionService.createSession({
        userId,
        tenantId,
        email: 'user@example.com',
        tier: 'basic',
      });

      const session3 = await sessionService.createSession({
        userId,
        tenantId,
        email: 'user@example.com',
        tier: 'basic',
      });

      // First session should be revoked
      const retrievedSession1 = await sessionService.getSession(session1.sessionId);
      expect(retrievedSession1).toBeNull();

      // Second and third sessions should exist
      const retrievedSession2 = await sessionService.getSession(session2.sessionId);
      const retrievedSession3 = await sessionService.getSession(session3.sessionId);
      expect(retrievedSession2).toBeDefined();
      expect(retrievedSession3).toBeDefined();

      const sessions = await sessionService.getUserSessions(userId, tenantId);
      expect(sessions).toHaveLength(2);
    });

    test('should enforce business tier limit (5 sessions)', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';

      // Create 6 sessions (business tier allows 5)
      const sessionIds = [];
      for (let i = 0; i < 6; i++) {
        const session = await sessionService.createSession({
          userId,
          tenantId,
          email: 'user@example.com',
          tier: 'business',
        });
        sessionIds.push(session.sessionId);
      }

      // First session should be revoked
      const firstSession = await sessionService.getSession(sessionIds[0]);
      expect(firstSession).toBeNull();

      const sessions = await sessionService.getUserSessions(userId, tenantId);
      expect(sessions).toHaveLength(5);
    });

    test('should enforce enterprise tier limit (10 sessions)', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';

      // Create 11 sessions (enterprise tier allows 10)
      const sessionIds = [];
      for (let i = 0; i < 11; i++) {
        const session = await sessionService.createSession({
          userId,
          tenantId,
          email: 'user@example.com',
          tier: 'enterprise',
        });
        sessionIds.push(session.sessionId);
      }

      // First session should be revoked
      const firstSession = await sessionService.getSession(sessionIds[0]);
      expect(firstSession).toBeNull();

      const sessions = await sessionService.getUserSessions(userId, tenantId);
      expect(sessions).toHaveLength(10);
    });
  });

  describe('User Sessions', () => {
    test('should get all active sessions for a user', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';

      await sessionService.createSession({
        userId,
        tenantId,
        email: 'user@example.com',
      });
      await sessionService.createSession({
        userId,
        tenantId,
        email: 'user@example.com',
      });

      const sessions = await sessionService.getUserSessions(userId, tenantId);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].userId).toBe(userId);
      expect(sessions[1].userId).toBe(userId);
    });

    test('should return empty array if user has no sessions', async () => {
      const sessions = await sessionService.getUserSessions('user-123', 'tenant-456');

      expect(sessions).toEqual([]);
    });

    test('should get session count for a user', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';

      await sessionService.createSession({
        userId,
        tenantId,
        email: 'user@example.com',
      });
      await sessionService.createSession({
        userId,
        tenantId,
        email: 'user@example.com',
      });

      const count = await sessionService.getUserSessionCount(userId, tenantId);

      expect(count).toBe(2);
    });
  });

  describe('Session Permissions Update', () => {
    test('should update session roles and permissions', async () => {
      const sessionData = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'user@example.com',
        roles: ['teacher'],
        permissions: ['read:students'],
      };

      const session = await sessionService.createSession(sessionData);

      const updatedSession = await sessionService.updateSessionPermissions(
        session.sessionId,
        ['teacher', 'admin'],
        ['read:students', 'write:students', 'read:all']
      );

      expect(updatedSession).toBeDefined();
      expect(updatedSession.roles).toEqual(['teacher', 'admin']);
      expect(updatedSession.permissions).toEqual([
        'read:students',
        'write:students',
        'read:all',
      ]);
    });

    test('should return null when updating non-existent session', async () => {
      const result = await sessionService.updateSessionPermissions(
        'non-existent-session-id',
        ['admin'],
        ['read:all']
      );

      expect(result).toBeNull();
    });
  });

  describe('Session Activity Tracking', () => {
    test('should track session activity', async () => {
      const sessionData = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'user@example.com',
      };

      const session = await sessionService.createSession(sessionData);
      await sessionService.touchSession(session.sessionId);
      await sessionService.revokeSession(session.sessionId);

      const activity = await sessionService.getSessionActivity(session.sessionId);

      expect(activity.length).toBeGreaterThanOrEqual(3);
      expect(activity.some(log => log.action === 'session_created')).toBe(true);
      expect(activity.some(log => log.action === 'session_accessed')).toBe(true);
      expect(activity.some(log => log.action === 'session_revoked')).toBe(true);
    });

    test('should limit activity log entries', async () => {
      const sessionData = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'user@example.com',
      };

      const session = await sessionService.createSession(sessionData);

      // Create many activity entries
      for (let i = 0; i < 150; i++) {
        await sessionService.touchSession(session.sessionId);
      }

      const activity = await sessionService.getSessionActivity(session.sessionId);

      // Should be limited to 100 entries
      expect(activity.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Session Configuration', () => {
    test('should get basic tier configuration', () => {
      const config = sessionService.getSessionConfig('basic');

      expect(config).toBeDefined();
      expect(config.maxConcurrentSessions).toBe(2);
      expect(config.slidingExpiration).toBe(3600);
      expect(config.absoluteExpiration).toBe(86400);
    });

    test('should get business tier configuration', () => {
      const config = sessionService.getSessionConfig('business');

      expect(config).toBeDefined();
      expect(config.maxConcurrentSessions).toBe(5);
      expect(config.slidingExpiration).toBe(7200);
      expect(config.absoluteExpiration).toBe(172800);
    });

    test('should get enterprise tier configuration', () => {
      const config = sessionService.getSessionConfig('enterprise');

      expect(config).toBeDefined();
      expect(config.maxConcurrentSessions).toBe(10);
      expect(config.slidingExpiration).toBe(14400);
      expect(config.absoluteExpiration).toBe(604800);
    });

    test('should default to basic tier for unknown tier', () => {
      const config = sessionService.getSessionConfig('unknown');

      expect(config).toBeDefined();
      expect(config.maxConcurrentSessions).toBe(2);
    });
  });

  describe('Redis Key Generation', () => {
    test('should generate correct session key', () => {
      const key = sessionService.getSessionKey('session-123');

      expect(key).toBe('session:session-123');
    });

    test('should generate correct user sessions key', () => {
      const key = sessionService.getUserSessionsKey('user-123', 'tenant-456');

      expect(key).toBe('session:user:tenant-456:user-123:sessions');
    });

    test('should generate correct session activity key', () => {
      const key = sessionService.getSessionActivityKey('session-123');

      expect(key).toBe('session:session-123:activity');
    });
  });
});
