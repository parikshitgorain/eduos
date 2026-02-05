/**
 * Session Routes Tests
 * 
 * Task: 1.3.3 - Build session management with Redis
 */

const request = require('supertest');
const express = require('express');
const sessionRoutes = require('./sessions');
const sessionService = require('../services/sessionService');
const { redis } = require('../config/redis');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/v1/sessions', sessionRoutes);

describe('Session Routes', () => {
  let testSession;

  beforeEach(async () => {
    await redis.flushdb();

    // Create a test session
    testSession = await sessionService.createSession({
      userId: 'user-123',
      tenantId: 'tenant-456',
      email: 'user@example.com',
      roles: ['teacher'],
      permissions: ['read:students'],
      tier: 'basic',
      metadata: {
        ip: '192.168.1.1',
        userAgent: 'Test Agent',
      },
    });
  });

  afterAll(async () => {
    await redis.flushdb();
    await redis.quit();
  });

  describe('GET /api/v1/sessions', () => {
    test('should get all user sessions', async () => {
      const response = await request(app)
        .get('/api/v1/sessions')
        .set('x-user-id', 'user-123')
        .set('x-tenant-id', 'tenant-456')
        .set('x-user-email', 'user@example.com');

      expect(response.status).toBe(200);
      expect(response.body.sessions).toBeDefined();
      expect(response.body.sessions.length).toBeGreaterThan(0);
      expect(response.body.count).toBeGreaterThan(0);
    });

    test('should return 401 if user not authenticated', async () => {
      const response = await request(app).get('/api/v1/sessions');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    test('should return empty array if user has no sessions', async () => {
      const response = await request(app)
        .get('/api/v1/sessions')
        .set('x-user-id', 'user-999')
        .set('x-tenant-id', 'tenant-999')
        .set('x-user-email', 'other@example.com');

      expect(response.status).toBe(200);
      expect(response.body.sessions).toEqual([]);
      expect(response.body.count).toBe(0);
    });
  });

  describe('GET /api/v1/sessions/:sessionId', () => {
    test('should get specific session', async () => {
      const response = await request(app)
        .get(`/api/v1/sessions/${testSession.sessionId}`)
        .set('x-user-id', 'user-123')
        .set('x-tenant-id', 'tenant-456')
        .set('x-user-email', 'user@example.com');

      expect(response.status).toBe(200);
      expect(response.body.session).toBeDefined();
      expect(response.body.session.sessionId).toBe(testSession.sessionId);
      expect(response.body.session.userId).toBe('user-123');
      expect(response.body.session.tenantId).toBe('tenant-456');
    });

    test('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .get('/api/v1/sessions/non-existent-session')
        .set('x-user-id', 'user-123')
        .set('x-tenant-id', 'tenant-456')
        .set('x-user-email', 'user@example.com');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
    });

    test('should return 403 if session belongs to different user', async () => {
      const response = await request(app)
        .get(`/api/v1/sessions/${testSession.sessionId}`)
        .set('x-user-id', 'user-999')
        .set('x-tenant-id', 'tenant-456')
        .set('x-user-email', 'other@example.com');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });
  });

  describe('DELETE /api/v1/sessions/:sessionId', () => {
    test('should revoke specific session', async () => {
      const response = await request(app)
        .delete(`/api/v1/sessions/${testSession.sessionId}`)
        .set('x-user-id', 'user-123')
        .set('x-tenant-id', 'tenant-456')
        .set('x-user-email', 'user@example.com');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Session revoked successfully');
      expect(response.body.sessionId).toBe(testSession.sessionId);

      // Verify session is revoked
      const session = await sessionService.getSession(testSession.sessionId);
      expect(session).toBeNull();
    });

    test('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .delete('/api/v1/sessions/non-existent-session')
        .set('x-user-id', 'user-123')
        .set('x-tenant-id', 'tenant-456')
        .set('x-user-email', 'user@example.com');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
    });

    test('should return 403 if session belongs to different user', async () => {
      const response = await request(app)
        .delete(`/api/v1/sessions/${testSession.sessionId}`)
        .set('x-user-id', 'user-999')
        .set('x-tenant-id', 'tenant-456')
        .set('x-user-email', 'other@example.com');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });
  });

  describe('DELETE /api/v1/sessions', () => {
    test('should revoke all user sessions', async () => {
      // Create multiple sessions
      await sessionService.createSession({
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'user@example.com',
      });

      const response = await request(app)
        .delete('/api/v1/sessions')
        .set('x-user-id', 'user-123')
        .set('x-tenant-id', 'tenant-456')
        .set('x-user-email', 'user@example.com');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('All sessions revoked successfully');
      expect(response.body.revokedCount).toBeGreaterThan(0);

      // Verify all sessions are revoked
      const sessions = await sessionService.getUserSessions('user-123', 'tenant-456');
      expect(sessions).toHaveLength(0);
    });

    test('should return 401 if user not authenticated', async () => {
      const response = await request(app).delete('/api/v1/sessions');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('GET /api/v1/sessions/:sessionId/activity', () => {
    test('should get session activity log', async () => {
      // Touch session to create activity
      await sessionService.touchSession(testSession.sessionId);

      const response = await request(app)
        .get(`/api/v1/sessions/${testSession.sessionId}/activity`)
        .set('x-user-id', 'user-123')
        .set('x-tenant-id', 'tenant-456')
        .set('x-user-email', 'user@example.com');

      expect(response.status).toBe(200);
      expect(response.body.activity).toBeDefined();
      expect(response.body.activity.length).toBeGreaterThan(0);
      expect(response.body.count).toBeGreaterThan(0);
    });

    test('should respect limit parameter', async () => {
      const response = await request(app)
        .get(`/api/v1/sessions/${testSession.sessionId}/activity?limit=5`)
        .set('x-user-id', 'user-123')
        .set('x-tenant-id', 'tenant-456')
        .set('x-user-email', 'user@example.com');

      expect(response.status).toBe(200);
      expect(response.body.activity.length).toBeLessThanOrEqual(5);
    });

    test('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .get('/api/v1/sessions/non-existent-session/activity')
        .set('x-user-id', 'user-123')
        .set('x-tenant-id', 'tenant-456')
        .set('x-user-email', 'user@example.com');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
    });

    test('should return 403 if session belongs to different user', async () => {
      const response = await request(app)
        .get(`/api/v1/sessions/${testSession.sessionId}/activity`)
        .set('x-user-id', 'user-999')
        .set('x-tenant-id', 'tenant-456')
        .set('x-user-email', 'other@example.com');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });
  });

  describe('POST /api/v1/sessions/revoke-security', () => {
    test('should revoke user sessions for security event (admin)', async () => {
      const response = await request(app)
        .post('/api/v1/sessions/revoke-security')
        .set('x-user-id', 'admin-123')
        .set('x-tenant-id', 'tenant-456')
        .set('x-user-email', 'admin@example.com')
        .set('x-user-roles', 'admin')
        .send({
          targetUserId: 'user-123',
          reason: 'suspicious_activity',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('User sessions revoked for security event');
      expect(response.body.targetUserId).toBe('user-123');
      expect(response.body.revokedCount).toBeGreaterThan(0);

      // Verify sessions are revoked
      const sessions = await sessionService.getUserSessions('user-123', 'tenant-456');
      expect(sessions).toHaveLength(0);
    });

    test('should return 403 if user is not admin', async () => {
      const response = await request(app)
        .post('/api/v1/sessions/revoke-security')
        .set('x-user-id', 'user-123')
        .set('x-tenant-id', 'tenant-456')
        .set('x-user-email', 'user@example.com')
        .set('x-user-roles', 'teacher')
        .send({
          targetUserId: 'user-456',
          reason: 'suspicious_activity',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    test('should return 400 if targetUserId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/sessions/revoke-security')
        .set('x-user-id', 'admin-123')
        .set('x-tenant-id', 'tenant-456')
        .set('x-user-email', 'admin@example.com')
        .set('x-user-roles', 'admin')
        .send({
          reason: 'suspicious_activity',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });
  });
});
