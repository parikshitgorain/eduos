/**
 * Domain Cache Service Tests
 * 
 * Task: 1.2.3 - Create tenant routing cache layer
 */

const {
  getCachedTenant,
  cacheTenant,
  invalidateCache,
  invalidateTenantCache,
  clearCache,
  getCacheStats,
  resetCacheStats,
  warmupCache,
  getCacheTTL,
  refreshCacheTTL,
  CACHE_TTL
} = require('./domainCacheService');

// Mock Redis if not available
jest.mock('../config/redis', () => {
  const mockRedis = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    pipeline: jest.fn(() => ({
      get: jest.fn(),
      setex: jest.fn(),
      exec: jest.fn()
    })),
    hincrby: jest.fn(),
    hgetall: jest.fn(),
    info: jest.fn(),
    ttl: jest.fn(),
    expire: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG')
  };
  
  return {
    redis: mockRedis,
    getClient: () => mockRedis,
    healthCheck: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(undefined)
  };
});

const { redis } = require('../config/redis');

describe('Domain Cache Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('getCachedTenant', () => {
    it('should return null on cache miss', async () => {
      redis.get.mockResolvedValue(null);
      
      const result = await getCachedTenant('test.com');
      
      expect(result).toBeNull();
      expect(redis.get).toHaveBeenCalledWith('domain:test.com');
    });
    
    it('should return cached tenant on cache hit', async () => {
      const cachedData = {
        tenant_id: 'test-tenant-id',
        tenant_name: 'Test School',
        tenant_tier: 'Basic',
        cachedAt: Date.now()
      };
      
      redis.get.mockResolvedValue(JSON.stringify(cachedData));
      
      const result = await getCachedTenant('test.com');
      
      expect(result).toEqual(cachedData);
      expect(redis.get).toHaveBeenCalledWith('domain:test.com');
    });
    
    it('should normalize domain to lowercase', async () => {
      redis.get.mockResolvedValue(null);
      
      await getCachedTenant('TEST.COM');
      
      expect(redis.get).toHaveBeenCalledWith('domain:test.com');
    });
    
    it('should handle Redis errors gracefully', async () => {
      redis.get.mockRejectedValue(new Error('Redis connection failed'));
      
      const result = await getCachedTenant('test.com');
      
      expect(result).toBeNull();
    });
  });
  
  describe('cacheTenant', () => {
    it('should cache tenant with TTL', async () => {
      const tenantInfo = {
        tenant_id: 'test-tenant-id',
        tenant_name: 'Test School',
        tenant_tier: 'Basic'
      };
      
      redis.setex.mockResolvedValue('OK');
      
      await cacheTenant('test.com', tenantInfo);
      
      expect(redis.setex).toHaveBeenCalledWith(
        'domain:test.com',
        CACHE_TTL,
        expect.stringContaining('test-tenant-id')
      );
    });
    
    it('should add cachedAt timestamp', async () => {
      const tenantInfo = {
        tenant_id: 'test-tenant-id'
      };
      
      redis.setex.mockResolvedValue('OK');
      
      await cacheTenant('test.com', tenantInfo);
      
      const cachedValue = JSON.parse(redis.setex.mock.calls[0][2]);
      expect(cachedValue).toHaveProperty('cachedAt');
      expect(typeof cachedValue.cachedAt).toBe('number');
    });
    
    it('should handle Redis errors gracefully', async () => {
      redis.setex.mockRejectedValue(new Error('Redis connection failed'));
      
      // Should not throw
      await expect(cacheTenant('test.com', {})).resolves.not.toThrow();
    });
  });
  
  describe('invalidateCache', () => {
    it('should delete cache entry', async () => {
      redis.del.mockResolvedValue(1);
      
      const result = await invalidateCache('test.com');
      
      expect(result).toBe(true);
      expect(redis.del).toHaveBeenCalledWith('domain:test.com');
    });
    
    it('should return false if key not found', async () => {
      redis.del.mockResolvedValue(0);
      
      const result = await invalidateCache('test.com');
      
      expect(result).toBe(false);
    });
    
    it('should handle Redis errors gracefully', async () => {
      redis.del.mockRejectedValue(new Error('Redis connection failed'));
      
      const result = await invalidateCache('test.com');
      
      expect(result).toBe(false);
    });
  });
  
  describe('invalidateTenantCache', () => {
    it('should invalidate all domains for a tenant', async () => {
      const mockKeys = ['domain:test1.com', 'domain:test2.com', 'domain:other.com'];
      const mockPipeline = {
        get: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, JSON.stringify({ tenant_id: 'tenant-1' })],
          [null, JSON.stringify({ tenant_id: 'tenant-1' })],
          [null, JSON.stringify({ tenant_id: 'tenant-2' })]
        ])
      };
      
      redis.keys.mockResolvedValue(mockKeys);
      redis.pipeline.mockReturnValue(mockPipeline);
      redis.del.mockResolvedValue(2);
      
      const result = await invalidateTenantCache('tenant-1');
      
      expect(result).toBe(2);
      expect(redis.del).toHaveBeenCalledWith('domain:test1.com', 'domain:test2.com');
    });
    
    it('should return 0 if no keys found', async () => {
      redis.keys.mockResolvedValue([]);
      
      const result = await invalidateTenantCache('tenant-1');
      
      expect(result).toBe(0);
    });
  });
  
  describe('clearCache', () => {
    it('should clear all domain cache entries', async () => {
      const mockKeys = ['domain:test1.com', 'domain:test2.com'];
      redis.keys.mockResolvedValue(mockKeys);
      redis.del.mockResolvedValue(2);
      
      const result = await clearCache();
      
      expect(result).toBe(2);
      expect(redis.del).toHaveBeenCalledWith(...mockKeys);
    });
    
    it('should return 0 if no keys found', async () => {
      redis.keys.mockResolvedValue([]);
      
      const result = await clearCache();
      
      expect(result).toBe(0);
    });
  });
  
  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      redis.hgetall.mockResolvedValue({ hits: '100', misses: '5' });
      redis.keys.mockResolvedValue(['domain:test1.com', 'domain:test2.com']);
      redis.info.mockResolvedValue('used_memory_human:1.5M\n');
      
      const stats = await getCacheStats();
      
      expect(stats).toMatchObject({
        totalEntries: 2,
        hits: 100,
        misses: 5,
        total: 105,
        hitRate: 95.24,
        cacheTTL: CACHE_TTL,
        memoryUsed: '1.5M'
      });
    });
    
    it('should calculate hit rate correctly', async () => {
      redis.hgetall.mockResolvedValue({ hits: '95', misses: '5' });
      redis.keys.mockResolvedValue([]);
      redis.info.mockResolvedValue('used_memory_human:1M\n');
      
      const stats = await getCacheStats();
      
      expect(stats.hitRate).toBe(95);
    });
    
    it('should handle zero requests', async () => {
      redis.hgetall.mockResolvedValue({});
      redis.keys.mockResolvedValue([]);
      redis.info.mockResolvedValue('used_memory_human:1M\n');
      
      const stats = await getCacheStats();
      
      expect(stats.hitRate).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });
  
  describe('warmupCache', () => {
    it('should cache multiple domains', async () => {
      const domains = [
        { domain: 'test1.com', tenantInfo: { tenant_id: 'tenant-1' } },
        { domain: 'test2.com', tenantInfo: { tenant_id: 'tenant-2' } }
      ];
      
      const mockPipeline = {
        setex: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      };
      
      redis.pipeline.mockReturnValue(mockPipeline);
      
      const result = await warmupCache(domains);
      
      expect(result).toBe(2);
      expect(mockPipeline.setex).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('getCacheTTL', () => {
    it('should return TTL for cached domain', async () => {
      redis.ttl.mockResolvedValue(250);
      
      const ttl = await getCacheTTL('test.com');
      
      expect(ttl).toBe(250);
      expect(redis.ttl).toHaveBeenCalledWith('domain:test.com');
    });
    
    it('should return -2 for non-existent key', async () => {
      redis.ttl.mockResolvedValue(-2);
      
      const ttl = await getCacheTTL('test.com');
      
      expect(ttl).toBe(-2);
    });
  });
  
  describe('refreshCacheTTL', () => {
    it('should refresh TTL for cached domain', async () => {
      redis.expire.mockResolvedValue(1);
      
      const result = await refreshCacheTTL('test.com');
      
      expect(result).toBe(true);
      expect(redis.expire).toHaveBeenCalledWith('domain:test.com', CACHE_TTL);
    });
    
    it('should return false if key not found', async () => {
      redis.expire.mockResolvedValue(0);
      
      const result = await refreshCacheTTL('test.com');
      
      expect(result).toBe(false);
    });
  });
  
  describe('Cache TTL configuration', () => {
    it('should have TTL of 5 minutes (300 seconds)', () => {
      expect(CACHE_TTL).toBe(300);
    });
  });
});
