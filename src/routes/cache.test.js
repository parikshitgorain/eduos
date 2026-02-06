/**
 * Cache Management Routes Tests
 */

const express = require('express');
const request = require('supertest');
const cacheRouter = require('./cache');
const domainCacheService = require('../services/domainCacheService');
const { query } = require('../config/database');

jest.mock('../services/domainCacheService');
jest.mock('../config/database');

describe('Cache Management Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/cache', cacheRouter);
    jest.clearAllMocks();
  });

  describe('GET /api/v1/cache/stats', () => {
    it('should return cache statistics', async () => {
      const mockStats = {
        totalEntries: 100,
        hits: 950,
        misses: 50,
        total: 1000,
        hitRate: 95,
        cacheTTL: 3600,
        memoryUsed: '10MB',
        timestamp: new Date().toISOString()
      };

      domainCacheService.getCacheStats.mockResolvedValue(mockStats);

      const response = await request(app).get('/api/v1/cache/stats');

      expect(response.status).toBe(200);
      expect(response.body.hitRate).toBe(95);
      expect(response.body.meetsHitRateSLA).toBe(true);
      expect(response.body.slaThreshold).toBe(95);
    });

    it('should indicate when hit rate does not meet SLA', async () => {
      const mockStats = {
        totalEntries: 100,
        hits: 900,
        misses: 100,
        total: 1000,
        hitRate: 90,
        cacheTTL: 3600,
        memoryUsed: '10MB',
        timestamp: new Date().toISOString()
      };

      domainCacheService.getCacheStats.mockResolvedValue(mockStats);

      const response = await request(app).get('/api/v1/cache/stats');

      expect(response.status).toBe(200);
      expect(response.body.meetsHitRateSLA).toBe(false);
    });

    it('should handle errors', async () => {
      domainCacheService.getCacheStats.mockRejectedValue(new Error('Cache error'));

      const response = await request(app).get('/api/v1/cache/stats');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal Server Error');
    });
  });

  describe('POST /api/v1/cache/invalidate', () => {
    it('should invalidate cache for a domain', async () => {
      domainCacheService.invalidateCache.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/cache/invalidate')
        .send({ domain: 'example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.domain).toBe('example.com');
      expect(domainCacheService.invalidateCache).toHaveBeenCalledWith('example.com');
    });

    it('should return 400 when domain is missing', async () => {
      const response = await request(app)
        .post('/api/v1/cache/invalidate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });

    it('should handle cache miss', async () => {
      domainCacheService.invalidateCache.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/v1/cache/invalidate')
        .send({ domain: 'notfound.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
    });

    it('should handle errors', async () => {
      domainCacheService.invalidateCache.mockRejectedValue(new Error('Cache error'));

      const response = await request(app)
        .post('/api/v1/cache/invalidate')
        .send({ domain: 'example.com' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/v1/cache/invalidate-tenant', () => {
    it('should invalidate cache for all tenant domains', async () => {
      domainCacheService.invalidateTenantCache.mockResolvedValue(5);

      const response = await request(app)
        .post('/api/v1/cache/invalidate-tenant')
        .send({ tenantId: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.domainsInvalidated).toBe(5);
      expect(domainCacheService.invalidateTenantCache).toHaveBeenCalledWith('tenant-123');
    });

    it('should return 400 when tenantId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/cache/invalidate-tenant')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });

    it('should handle errors', async () => {
      domainCacheService.invalidateTenantCache.mockRejectedValue(new Error('Cache error'));

      const response = await request(app)
        .post('/api/v1/cache/invalidate-tenant')
        .send({ tenantId: 'tenant-123' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/v1/cache/clear', () => {
    it('should clear entire cache', async () => {
      domainCacheService.clearCache.mockResolvedValue(100);

      const response = await request(app).post('/api/v1/cache/clear');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.entriesCleared).toBe(100);
      expect(domainCacheService.clearCache).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      domainCacheService.clearCache.mockRejectedValue(new Error('Cache error'));

      const response = await request(app).post('/api/v1/cache/clear');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/v1/cache/reset-stats', () => {
    it('should reset cache statistics', async () => {
      domainCacheService.resetCacheStats.mockResolvedValue();

      const response = await request(app).post('/api/v1/cache/reset-stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(domainCacheService.resetCacheStats).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      domainCacheService.resetCacheStats.mockRejectedValue(new Error('Cache error'));

      const response = await request(app).post('/api/v1/cache/reset-stats');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/v1/cache/warmup', () => {
    it('should warm up cache with active domains', async () => {
      const mockDomains = [
        {
          domain: 'school1.eduos.com',
          tenant_id: 'tenant-1',
          tenant_name: 'School 1',
          tenant_tier: 'premium',
          tenant_status: 'active',
          domain_type: 'subdomain',
          is_verified: true
        },
        {
          domain: 'school2.com',
          tenant_id: 'tenant-2',
          tenant_name: 'School 2',
          tenant_tier: 'basic',
          tenant_status: 'active',
          domain_type: 'custom',
          is_verified: true
        }
      ];

      query.mockResolvedValue({ rows: mockDomains });
      domainCacheService.warmupCache.mockResolvedValue(2);

      const response = await request(app).post('/api/v1/cache/warmup');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.domainsCached).toBe(2);
      expect(domainCacheService.warmupCache).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      query.mockRejectedValue(new Error('Database error'));

      const response = await request(app).post('/api/v1/cache/warmup');

      expect(response.status).toBe(500);
    });

    it('should handle cache warmup errors', async () => {
      query.mockResolvedValue({ rows: [] });
      domainCacheService.warmupCache.mockRejectedValue(new Error('Warmup error'));

      const response = await request(app).post('/api/v1/cache/warmup');

      expect(response.status).toBe(500);
    });
  });
});
