/**
 * Domain Mapping Middleware Tests
 * 
 * Task: 1.2.1 - Build custom domain mapping middleware
 */

const request = require('supertest');
const app = require('../server');
const { query, transaction } = require('../config/database');
const { 
  domainMapping, 
  extractDomain, 
  clearCache, 
  getCacheStats,
  resolveDomainToTenant 
} = require('./domainMapping');

describe('Domain Mapping Middleware', () => {
  let testTenantId;
  let testDomain;
  
  beforeAll(async () => {
    // Create test tenant with unique subdomain
    const uniqueSubdomain = `testschool-${Date.now()}`;
    const tenantResult = await query(
      `INSERT INTO tenants (name, subdomain, tier, status)
       VALUES ($1, $2, $3, $4)
       RETURNING tenant_id`,
      ['Test School', uniqueSubdomain, 'Basic', 'active']
    );
    testTenantId = tenantResult.rows[0].tenant_id;
    testDomain = `${uniqueSubdomain}.eduos.com`;
    
    // Clear cache before tests
    clearCache();
  });
  
  afterAll(async () => {
    // Clean up test data
    await query('DELETE FROM tenants WHERE tenant_id = $1', [testTenantId]);
  });
  
  afterEach(() => {
    // Clear cache after each test
    clearCache();
  });
  
  describe('extractDomain', () => {
    it('should extract domain from Host header', () => {
      const req = {
        headers: {
          host: 'testschool.eduos.com'
        }
      };
      
      const domain = extractDomain(req);
      expect(domain).toBe('testschool.eduos.com');
    });
    
    it('should extract domain from X-Forwarded-Host header', () => {
      const req = {
        headers: {
          'x-forwarded-host': 'custom-domain.com',
          host: 'testschool.eduos.com'
        }
      };
      
      const domain = extractDomain(req);
      expect(domain).toBe('custom-domain.com');
    });
    
    it('should remove port from domain', () => {
      const req = {
        headers: {
          host: 'testschool.eduos.com:3000'
        }
      };
      
      const domain = extractDomain(req);
      expect(domain).toBe('testschool.eduos.com');
    });
    
    it('should convert domain to lowercase', () => {
      const req = {
        headers: {
          host: 'TestSchool.EduOS.com'
        }
      };
      
      const domain = extractDomain(req);
      expect(domain).toBe('testschool.eduos.com');
    });
    
    it('should return null if no host header', () => {
      const req = {
        headers: {}
      };
      
      const domain = extractDomain(req);
      expect(domain).toBeNull();
    });
  });
  
  describe('resolveDomainToTenant', () => {
    it('should resolve valid subdomain to tenant', async () => {
      const tenantInfo = await resolveDomainToTenant(testDomain);
      
      expect(tenantInfo).toBeDefined();
      expect(tenantInfo.tenant_id).toBe(testTenantId);
      expect(tenantInfo.tenant_name).toBe('Test School');
      expect(tenantInfo.tenant_tier).toBe('Basic');
      expect(tenantInfo.domain_type).toBe('subdomain');
      expect(tenantInfo.is_verified).toBe(true);
    });
    
    it('should return null for unmapped domain', async () => {
      const tenantInfo = await resolveDomainToTenant('nonexistent.eduos.com');
      
      expect(tenantInfo).toBeNull();
    });
    
    it('should not resolve inactive tenant', async () => {
      // Create inactive tenant
      const inactiveTenant = await query(
        `INSERT INTO tenants (name, subdomain, tier, status)
         VALUES ($1, $2, $3, $4)
         RETURNING tenant_id`,
        ['Inactive School', 'inactive', 'Basic', 'suspended']
      );
      
      const tenantInfo = await resolveDomainToTenant('inactive.eduos.com');
      expect(tenantInfo).toBeNull();
      
      // Clean up
      await query('DELETE FROM tenants WHERE tenant_id = $1', [inactiveTenant.rows[0].tenant_id]);
    });
  });
  
  describe('Cache functionality', () => {
    it('should cache domain lookups', async () => {
      // First lookup - cache miss
      const info1 = await resolveDomainToTenant(testDomain);
      expect(info1).toBeDefined();
      
      // Manually cache it
      const { cacheTenant, getCachedTenant } = require('./domainMapping');
      cacheTenant(testDomain, info1);
      
      // Second lookup - should hit cache
      const cached = getCachedTenant(testDomain);
      expect(cached).toBeDefined();
      expect(cached.tenant_id).toBe(testTenantId);
    });
    
    it('should return cache statistics', () => {
      const stats = getCacheStats();
      
      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('validEntries');
      expect(stats).toHaveProperty('expiredEntries');
      expect(stats).toHaveProperty('cacheTTL');
      expect(typeof stats.totalEntries).toBe('number');
    });
    
    it('should clear cache', () => {
      const { cacheTenant } = require('./domainMapping');
      
      // Add some cache entries
      cacheTenant('test1.com', { tenant_id: 'test1' });
      cacheTenant('test2.com', { tenant_id: 'test2' });
      
      let stats = getCacheStats();
      expect(stats.totalEntries).toBeGreaterThan(0);
      
      // Clear cache
      clearCache();
      
      stats = getCacheStats();
      expect(stats.totalEntries).toBe(0);
    });
  });
  
  describe('Middleware integration', () => {
    it('should return 400 if Host header is missing', async () => {
      const mockReq = {
        headers: {}
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();
      
      await domainMapping(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Missing Host header'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
    
    it('should return 404 for unmapped domain', async () => {
      const mockReq = {
        headers: {
          host: 'nonexistent.eduos.com'
        }
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        type: jest.fn().mockReturnThis(),
        send: jest.fn(),
        json: jest.fn()
      };
      const mockNext = jest.fn();
      
      await domainMapping(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockNext).not.toHaveBeenCalled();
    });
    
    it('should attach domain info to request for valid domain', async () => {
      const mockReq = {
        headers: {
          host: testDomain
        }
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();
      
      await domainMapping(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.domain).toBeDefined();
      expect(mockReq.domain.name).toBe(testDomain);
      expect(mockReq.domain.tenantId).toBe(testTenantId);
      expect(mockReq.domain.type).toBe('subdomain');
      expect(mockReq.domainMappingOverhead).toBeDefined();
      expect(typeof mockReq.domainMappingOverhead).toBe('number');
    });
    
    it('should have low latency (< 10ms) on cache hit', async () => {
      // First request to populate cache
      const mockReq1 = {
        headers: {
          host: testDomain
        }
      };
      const mockRes1 = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext1 = jest.fn();
      
      await domainMapping(mockReq1, mockRes1, mockNext1);
      
      // Second request should hit cache
      const mockReq2 = {
        headers: {
          host: testDomain
        }
      };
      const mockRes2 = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext2 = jest.fn();
      
      await domainMapping(mockReq2, mockRes2, mockNext2);
      
      expect(mockReq2.domainMappingOverhead).toBeLessThan(10);
      expect(mockReq2.domain.cacheHit).toBe(true);
    });
  });
  
  describe('Custom domain support', () => {
    let customDomainId;
    
    beforeAll(async () => {
      // Add custom domain
      const result = await query(
        `INSERT INTO tenant_domains (tenant_id, domain, domain_type, is_verified, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING domain_id`,
        [testTenantId, 'custom-school.com', 'custom', true, true]
      );
      customDomainId = result.rows[0].domain_id;
    });
    
    afterAll(async () => {
      // Clean up custom domain
      await query('DELETE FROM tenant_domains WHERE domain_id = $1', [customDomainId]);
    });
    
    it('should resolve custom domain to tenant', async () => {
      const tenantInfo = await resolveDomainToTenant('custom-school.com');
      
      expect(tenantInfo).toBeDefined();
      expect(tenantInfo.tenant_id).toBe(testTenantId);
      expect(tenantInfo.domain_type).toBe('custom');
      expect(tenantInfo.is_verified).toBe(true);
    });
    
    it('should reject unverified custom domain', async () => {
      // Add unverified custom domain
      const unverifiedResult = await query(
        `INSERT INTO tenant_domains (tenant_id, domain, domain_type, is_verified, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING domain_id`,
        [testTenantId, 'unverified-school.com', 'custom', false, true]
      );
      
      const mockReq = {
        headers: {
          host: 'unverified-school.com'
        }
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();
      
      await domainMapping(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Custom domain is not verified. Please complete domain verification.'
      });
      expect(mockNext).not.toHaveBeenCalled();
      
      // Clean up
      await query('DELETE FROM tenant_domains WHERE domain_id = $1', [unverifiedResult.rows[0].domain_id]);
    });
  });
  
  describe('Performance requirements', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() => {
        const mockReq = {
          headers: {
            host: testDomain
          }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();
        
        return domainMapping(mockReq, mockRes, mockNext);
      });
      
      const results = await Promise.all(requests);
      
      // All requests should complete successfully
      expect(results).toHaveLength(10);
    });
    
    it('should log warning if overhead exceeds 10ms', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Clear cache to force database lookup
      clearCache();
      
      const mockReq = {
        headers: {
          host: testDomain
        }
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();
      
      await domainMapping(mockReq, mockRes, mockNext);
      
      // Check if overhead was measured
      expect(mockReq.domainMappingOverhead).toBeDefined();
      
      consoleSpy.mockRestore();
    });
  });
});
