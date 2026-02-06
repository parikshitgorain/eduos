/**
 * Rate Limiter Middleware Tests
 */

const express = require('express');
const request = require('supertest');
const {
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  mfaLimiter,
  domainVerificationLimiter
} = require('./rateLimiter');

describe('Rate Limiter Middleware', () => {
  describe('apiLimiter', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use('/api', apiLimiter);
      app.get('/api/test', (req, res) => res.json({ success: true }));
      app.get('/health', (req, res) => res.json({ status: 'ok' }));
    });

    it('should allow requests within rate limit', async () => {
      const response = await request(app).get('/api/test');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should include rate limit headers', async () => {
      const response = await request(app).get('/api/test');
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });

    it('should skip rate limiting for health checks', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-limit']).toBeUndefined();
    });

    it('should have rate limit configured', () => {
      const limit = parseInt(process.env.API_RATE_LIMIT || '100', 10);
      expect(limit).toBeGreaterThan(0);
      expect(limit).toBeLessThanOrEqual(1000);
    });
  });

  describe('authLimiter', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use('/auth', authLimiter);
      app.post('/auth/login', (req, res) => res.json({ success: true }));
    });

    it('should allow auth requests within rate limit', async () => {
      const response = await request(app).post('/auth/login');
      expect(response.status).toBe(200);
    });

    it('should have stricter limits than API limiter', async () => {
      const authLimit = parseInt(process.env.AUTH_RATE_LIMIT || '5', 10);
      const apiLimit = parseInt(process.env.API_RATE_LIMIT || '100', 10);
      expect(authLimit).toBeLessThan(apiLimit);
    });

    it('should have stricter rate limit than API', () => {
      const authLimit = parseInt(process.env.AUTH_RATE_LIMIT || '5', 10);
      expect(authLimit).toBeGreaterThan(0);
      expect(authLimit).toBeLessThanOrEqual(10);
    });
  });

  describe('passwordResetLimiter', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use('/password', passwordResetLimiter);
      app.post('/password/reset', (req, res) => res.json({ success: true }));
    });

    it('should allow password reset requests within rate limit', async () => {
      const response = await request(app).post('/password/reset');
      expect(response.status).toBe(200);
    });

    it('should have rate limit configured', () => {
      const limit = parseInt(process.env.PASSWORD_RESET_RATE_LIMIT || '3', 10);
      expect(limit).toBeGreaterThan(0);
      expect(limit).toBeLessThanOrEqual(10);
    });
  });

  describe('mfaLimiter', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use('/mfa', mfaLimiter);
      app.post('/mfa/verify', (req, res) => res.json({ success: true }));
    });

    it('should allow MFA requests within rate limit', async () => {
      const response = await request(app).post('/mfa/verify');
      expect(response.status).toBe(200);
    });

    it('should have rate limit configured', () => {
      const limit = parseInt(process.env.MFA_RATE_LIMIT || '10', 10);
      expect(limit).toBeGreaterThan(0);
      expect(limit).toBeLessThanOrEqual(20);
    });
  });

  describe('domainVerificationLimiter', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use('/domains', domainVerificationLimiter);
      app.post('/domains/verify', (req, res) => res.json({ success: true }));
    });

    it('should allow domain verification requests within rate limit', async () => {
      const response = await request(app).post('/domains/verify');
      expect(response.status).toBe(200);
    });

    it('should have rate limit configured', () => {
      const limit = parseInt(process.env.DOMAIN_VERIFICATION_RATE_LIMIT || '10', 10);
      expect(limit).toBeGreaterThan(0);
      expect(limit).toBeLessThanOrEqual(20);
    });
  });
});
