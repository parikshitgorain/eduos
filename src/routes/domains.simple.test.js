/**
 * Simple Domain Routes Tests
 * Focus on basic functionality and coverage
 */

const request = require('supertest');
const express = require('express');
const domainRoutes = require('./domains');

// Mock dependencies
jest.mock('../config/database');
jest.mock('../services/domainCacheService', () => ({
  invalidateCache: jest.fn(),
  getCacheStats: jest.fn(),
  clearCache: jest.fn()
}));
jest.mock('../services/domainVerificationService', () => ({
  provisionSSLCertificate: jest.fn()
}));
jest.mock('../jobs/domainVerificationJob', () => ({
  getJobStatus: jest.fn(),
  triggerJob: jest.fn()
}));
jest.mock('dns', () => ({
  promises: {
    resolveTxt: jest.fn()
  }
}));

const { invalidateCache, getCacheStats, clearCache } = require('../services/domainCacheService');
const { provisionSSLCertificate } = require('../services/domainVerificationService');
const { getJobStatus, triggerJob } = require('../jobs/domainVerificationJob');
const dns = require('dns');

// Create test app
const app = express();
app.use(express.json());

// Mock middleware to add tenant and dbClient
app.use((req, res, next) => {
  req.tenant = { id: '123e4567-e89b-12d3-a456-426614174000' };
  req.dbClient = {
    query: jest.fn(),
    release: jest.fn()
  };
  next();
});

app.use('/api/v1/domains', domainRoutes);

describe('Domain Routes - Simple Coverage Tests', () => {
  const mockTenantId = '123e4567-e89b-12d3-a456-426614174000';
  const mockDomainId = '223e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/domains', () => {
    it('should list domains successfully', async () => {
      const mockDomains = [
        { domain_id: mockDomainId, domain: 'school.example.com', is_verified: true }
      ];

      app.request.dbClient = {
        query: jest.fn().mockResolvedValue({ rows: mockDomains, rowCount: 1 })
      };

      // Mock the middleware for this specific test
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.tenant = { id: mockTenantId };
        req.dbClient = { query: jest.fn().mockResolvedValue({ rows: mockDomains, rowCount: 1 }) };
        next();
      });
      testApp.use('/api/v1/domains', domainRoutes);

      const response = await request(testApp)
        .get('/api/v1/domains');

      expect(response.status).toBe(200);
      expect(response.body.tenant_id).toBe(mockTenantId);
      expect(response.body.domains).toEqual(mockDomains);
    });
  });

  describe('GET /api/v1/domains/:domainId', () => {
    it('should get domain by ID successfully', async () => {
      const mockDomain = { domain_id: mockDomainId, domain: 'school.example.com' };

      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.tenant = { id: mockTenantId };
        req.dbClient = { query: jest.fn().mockResolvedValue({ rows: [mockDomain], rowCount: 1 }) };
        next();
      });
      testApp.use('/api/v1/domains', domainRoutes);

      const response = await request(testApp)
        .get(`/api/v1/domains/${mockDomainId}`);

      expect(response.status).toBe(200);
      expect(response.body.domain).toEqual(mockDomain);
    });

    it('should return 404 for non-existent domain', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.tenant = { id: mockTenantId };
        req.dbClient = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
        next();
      });
      testApp.use('/api/v1/domains', domainRoutes);

      const response = await request(testApp)
        .get(`/api/v1/domains/${mockDomainId}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Domain not found');
    });
  });

  describe('POST /api/v1/domains', () => {
    it('should validate required domain field', async () => {
      // Mock the database client
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.tenant = { id: mockTenantId };
        req.dbClient = { 
          query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
        };
        next();
      });
      testApp.use('/api/v1/domains', domainRoutes);

      const response = await request(testApp)
        .post('/api/v1/domains')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Missing required field: domain');
    });

    it('should validate domain format', async () => {
      // Mock the database client to prevent the route from trying to insert
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.tenant = { id: mockTenantId };
        req.dbClient = { 
          query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
        };
        next();
      });
      testApp.use('/api/v1/domains', domainRoutes);

      const response = await request(testApp)
        .post('/api/v1/domains')
        .send({ domain: '-invalid.domain-' }); // Invalid: starts and ends with hyphen

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid domain format');
    });

    it('should reject .eduos.com subdomains', async () => {
      // Mock the database client
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.tenant = { id: mockTenantId };
        req.dbClient = { 
          query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
        };
        next();
      });
      testApp.use('/api/v1/domains', domainRoutes);

      const response = await request(testApp)
        .post('/api/v1/domains')
        .send({ domain: 'test.eduos.com' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Cannot add .eduos.com subdomains. These are managed automatically.');
    });

    it('should create domain successfully', async () => {
      const mockCreatedDomain = {
        domain_id: mockDomainId,
        domain: 'school.example.com',
        verification_token: 'token123'
      };

      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.tenant = { id: mockTenantId };
        req.dbClient = { query: jest.fn().mockResolvedValue({ rows: [mockCreatedDomain], rowCount: 1 }) };
        next();
      });
      testApp.use('/api/v1/domains', domainRoutes);

      const response = await request(testApp)
        .post('/api/v1/domains')
        .send({ domain: 'school.example.com' });

      expect(response.status).toBe(201);
      expect(response.body.domain).toEqual(mockCreatedDomain);
    });

    it('should handle duplicate domain error', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.tenant = { id: mockTenantId };
        const error = new Error('Duplicate');
        error.code = '23505';
        req.dbClient = { query: jest.fn().mockRejectedValue(error) };
        next();
      });
      testApp.use('/api/v1/domains', domainRoutes);

      const response = await request(testApp)
        .post('/api/v1/domains')
        .send({ domain: 'existing.example.com' });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Domain already exists');
    });
  });

  describe('POST /api/v1/domains/:domainId/verify', () => {
    it('should return 404 for non-existent domain', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.tenant = { id: mockTenantId };
        req.dbClient = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
        next();
      });
      testApp.use('/api/v1/domains', domainRoutes);

      const response = await request(testApp)
        .post(`/api/v1/domains/${mockDomainId}/verify`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Domain not found');
    });

    it('should handle already verified domain', async () => {
      const mockDomain = {
        domain_id: mockDomainId,
        domain: 'school.example.com',
        is_verified: true
      };

      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.tenant = { id: mockTenantId };
        req.dbClient = { query: jest.fn().mockResolvedValue({ rows: [mockDomain], rowCount: 1 }) };
        next();
      });
      testApp.use('/api/v1/domains', domainRoutes);

      const response = await request(testApp)
        .post(`/api/v1/domains/${mockDomainId}/verify`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Domain is already verified');
    });

    it('should handle DNS verification failure', async () => {
      const mockDomain = {
        domain_id: mockDomainId,
        domain: 'school.example.com',
        verification_token: 'token123',
        is_verified: false
      };

      dns.promises.resolveTxt.mockRejectedValue({ code: 'ENOTFOUND' });

      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.tenant = { id: mockTenantId };
        req.dbClient = { query: jest.fn().mockResolvedValue({ rows: [mockDomain], rowCount: 1 }) };
        next();
      });
      testApp.use('/api/v1/domains', domainRoutes);

      const response = await request(testApp)
        .post(`/api/v1/domains/${mockDomainId}/verify`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Verification Failed');
    });
  });

  describe('DELETE /api/v1/domains/:domainId', () => {
    it('should return 404 for non-existent domain', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.tenant = { id: mockTenantId };
        req.dbClient = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
        next();
      });
      testApp.use('/api/v1/domains', domainRoutes);

      const response = await request(testApp)
        .delete(`/api/v1/domains/${mockDomainId}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Domain not found');
    });

    it('should prevent deletion of default subdomain', async () => {
      const mockDomain = { domain: 'school.eduos.com', domain_type: 'subdomain' };

      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.tenant = { id: mockTenantId };
        req.dbClient = { query: jest.fn().mockResolvedValue({ rows: [mockDomain], rowCount: 1 }) };
        next();
      });
      testApp.use('/api/v1/domains', domainRoutes);

      const response = await request(testApp)
        .delete(`/api/v1/domains/${mockDomainId}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Cannot delete default subdomain');
    });

    it('should delete domain successfully', async () => {
      const mockDomain = { domain: 'school.example.com', domain_type: 'custom' };

      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.tenant = { id: mockTenantId };
        req.dbClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockDomain], rowCount: 1 })
            .mockResolvedValueOnce({ rowCount: 1 })
        };
        next();
      });
      testApp.use('/api/v1/domains', domainRoutes);

      const response = await request(testApp)
        .delete(`/api/v1/domains/${mockDomainId}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Domain deleted successfully');
      expect(invalidateCache).toHaveBeenCalledWith('school.example.com');
    });
  });

  describe('Cache Routes', () => {
    it('should get cache stats', async () => {
      const mockStats = { hits: 100, misses: 10 };
      getCacheStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/v1/domains/cache/stats');

      expect(response.status).toBe(200);
      expect(response.body.cache_stats).toEqual(mockStats);
    });

    it('should clear cache', async () => {
      clearCache.mockResolvedValue(50);

      const response = await request(app)
        .post('/api/v1/domains/cache/clear');

      expect(response.status).toBe(200);
      expect(response.body.entries_cleared).toBe(50);
    });
  });

  describe('SSL Provisioning', () => {
    it('should provision SSL successfully', async () => {
      const mockResult = {
        success: true,
        domain: 'school.example.com',
        sslStatus: 'active',
        issuedAt: '2026-01-01T00:00:00Z',
        expiresAt: '2026-04-01T00:00:00Z'
      };
      provisionSSLCertificate.mockResolvedValue(mockResult);

      const response = await request(app)
        .post(`/api/v1/domains/${mockDomainId}/provision-ssl`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('SSL certificate provisioned successfully');
    });

    it('should handle SSL provisioning failure', async () => {
      const mockResult = { success: false, reason: 'Domain not verified' };
      provisionSSLCertificate.mockResolvedValue(mockResult);

      const response = await request(app)
        .post(`/api/v1/domains/${mockDomainId}/provision-ssl`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('SSL Provisioning Failed');
    });

    it('should handle SSL provisioning errors', async () => {
      provisionSSLCertificate.mockRejectedValue(new Error('SSL error'));

      const response = await request(app)
        .post(`/api/v1/domains/${mockDomainId}/provision-ssl`);

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to provision SSL certificate');
    });
  });

  describe('Job Management', () => {
    it('should get job status', async () => {
      const mockStatus = { running: false, lastRun: '2026-01-01T00:00:00Z' };
      getJobStatus.mockReturnValue(mockStatus);

      const response = await request(app)
        .get('/api/v1/domains/jobs/status');

      expect(response.status).toBe(200);
      expect(response.body.job_status).toEqual(mockStatus);
    });

    it('should trigger job successfully', async () => {
      const mockResult = { verified: 5, failed: 0 };
      triggerJob.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/domains/jobs/trigger');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Background job triggered successfully');
    });

    it('should handle job trigger errors', async () => {
      triggerJob.mockRejectedValue(new Error('Job error'));

      const response = await request(app)
        .post('/api/v1/domains/jobs/trigger');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to trigger background job');
    });
  });
});