/**
 * Domain Cache Service
 * 
 * Redis-based caching layer for domain-to-tenant mappings.
 * 
 * Task: 1.2.3 - Create tenant routing cache layer
 * 
 * Definition of Done:
 * - Redis cache stores domain → tenant_id mappings
 * - Cache TTL: 5 minutes with automatic refresh
 * - Cache invalidation on domain configuration changes
 * - Fallback to database query if cache miss
 * - Monitoring: cache hit rate > 95%
 */

const { redis } = require('../config/redis');

// Cache configuration
const CACHE_TTL = 5 * 60; // 5 minutes in seconds
const CACHE_KEY_PREFIX = 'domain:';
const STATS_KEY = 'domain:cache:stats';

/**
 * Generate cache key for domain
 * @param {string} domain - Domain name
 * @returns {string} - Redis cache key
 */
function getCacheKey(domain) {
  return `${CACHE_KEY_PREFIX}${domain.toLowerCase()}`;
}

/**
 * Get tenant information from cache
 * 
 * @param {string} domain - Domain to lookup
 * @returns {Promise<Object|null>} - Cached tenant info or null if miss
 */
async function getCachedTenant(domain) {
  try {
    const key = getCacheKey(domain);
    const cached = await redis.get(key);
    
    if (!cached) {
      // Record cache miss
      await recordCacheMiss();
      return null;
    }
    
    // Record cache hit
    await recordCacheHit();
    
    // Parse and return cached data
    return JSON.parse(cached);
  } catch (error) {
    console.error('Error getting cached tenant:', error);
    // On error, treat as cache miss
    await recordCacheMiss();
    return null;
  }
}

/**
 * Store tenant information in cache
 * 
 * @param {string} domain - Domain key
 * @param {Object} tenantInfo - Tenant information to cache
 * @returns {Promise<void>}
 */
async function cacheTenant(domain, tenantInfo) {
  try {
    const key = getCacheKey(domain);
    const value = JSON.stringify({
      ...tenantInfo,
      cachedAt: Date.now()
    });
    
    // Set with TTL (5 minutes)
    await redis.setex(key, CACHE_TTL, value);
  } catch (error) {
    console.error('Error caching tenant:', error);
    // Don't throw - caching failure shouldn't break the request
  }
}

/**
 * Invalidate cache for a specific domain
 * 
 * @param {string} domain - Domain to invalidate
 * @returns {Promise<boolean>} - True if key was deleted
 */
async function invalidateCache(domain) {
  try {
    const key = getCacheKey(domain);
    const result = await redis.del(key);
    return result > 0;
  } catch (error) {
    console.error('Error invalidating cache:', error);
    return false;
  }
}

/**
 * Invalidate cache for all domains of a tenant
 * 
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<number>} - Number of keys deleted
 */
async function invalidateTenantCache(tenantId) {
  try {
    // Find all domain keys for this tenant
    const pattern = `${CACHE_KEY_PREFIX}*`;
    const keys = await redis.keys(pattern);
    
    if (keys.length === 0) {
      return 0;
    }
    
    // Get all cached values
    const pipeline = redis.pipeline();
    keys.forEach(key => pipeline.get(key));
    const results = await pipeline.exec();
    
    // Filter keys that belong to this tenant
    const keysToDelete = [];
    results.forEach((result, index) => {
      if (result[1]) {
        try {
          const data = JSON.parse(result[1]);
          if (data.tenant_id === tenantId) {
            keysToDelete.push(keys[index]);
          }
        } catch (e) {
          // Invalid JSON, delete it anyway
          keysToDelete.push(keys[index]);
        }
      }
    });
    
    // Delete matching keys
    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
    }
    
    return keysToDelete.length;
  } catch (error) {
    console.error('Error invalidating tenant cache:', error);
    return 0;
  }
}

/**
 * Clear entire domain cache
 * Useful for testing or manual cache refresh
 * 
 * @returns {Promise<number>} - Number of keys deleted
 */
async function clearCache() {
  try {
    const pattern = `${CACHE_KEY_PREFIX}*`;
    const keys = await redis.keys(pattern);
    
    if (keys.length === 0) {
      return 0;
    }
    
    await redis.del(...keys);
    return keys.length;
  } catch (error) {
    console.error('Error clearing cache:', error);
    return 0;
  }
}

/**
 * Record cache hit for statistics
 * @returns {Promise<void>}
 */
async function recordCacheHit() {
  try {
    await redis.hincrby(STATS_KEY, 'hits', 1);
  } catch (error) {
    // Silently fail - stats are not critical
  }
}

/**
 * Record cache miss for statistics
 * @returns {Promise<void>}
 */
async function recordCacheMiss() {
  try {
    await redis.hincrby(STATS_KEY, 'misses', 1);
  } catch (error) {
    // Silently fail - stats are not critical
  }
}

/**
 * Get cache statistics
 * Useful for monitoring and debugging
 * 
 * @returns {Promise<Object>} - Cache statistics
 */
async function getCacheStats() {
  try {
    // Get hit/miss counts
    const stats = await redis.hgetall(STATS_KEY);
    const hits = parseInt(stats.hits || '0', 10);
    const misses = parseInt(stats.misses || '0', 10);
    const total = hits + misses;
    
    // Calculate hit rate
    const hitRate = total > 0 ? (hits / total) * 100 : 0;
    
    // Get total cached entries
    const pattern = `${CACHE_KEY_PREFIX}*`;
    const keys = await redis.keys(pattern);
    const totalEntries = keys.length;
    
    // Get memory usage
    const info = await redis.info('memory');
    const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
    const memoryUsed = memoryMatch ? memoryMatch[1] : 'unknown';
    
    return {
      totalEntries,
      hits,
      misses,
      total,
      hitRate: parseFloat(hitRate.toFixed(2)),
      cacheTTL: CACHE_TTL,
      memoryUsed,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return {
      totalEntries: 0,
      hits: 0,
      misses: 0,
      total: 0,
      hitRate: 0,
      cacheTTL: CACHE_TTL,
      memoryUsed: 'unknown',
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Reset cache statistics
 * @returns {Promise<void>}
 */
async function resetCacheStats() {
  try {
    await redis.del(STATS_KEY);
  } catch (error) {
    console.error('Error resetting cache stats:', error);
  }
}

/**
 * Warm up cache with frequently accessed domains
 * 
 * @param {Array<Object>} domains - Array of {domain, tenantInfo} objects
 * @returns {Promise<number>} - Number of domains cached
 */
async function warmupCache(domains) {
  try {
    const pipeline = redis.pipeline();
    
    domains.forEach(({ domain, tenantInfo }) => {
      const key = getCacheKey(domain);
      const value = JSON.stringify({
        ...tenantInfo,
        cachedAt: Date.now()
      });
      pipeline.setex(key, CACHE_TTL, value);
    });
    
    await pipeline.exec();
    return domains.length;
  } catch (error) {
    console.error('Error warming up cache:', error);
    return 0;
  }
}

/**
 * Get TTL for a cached domain
 * 
 * @param {string} domain - Domain to check
 * @returns {Promise<number>} - TTL in seconds, -1 if no expiry, -2 if not found
 */
async function getCacheTTL(domain) {
  try {
    const key = getCacheKey(domain);
    return await redis.ttl(key);
  } catch (error) {
    console.error('Error getting cache TTL:', error);
    return -2;
  }
}

/**
 * Refresh cache TTL for a domain (extend expiration)
 * 
 * @param {string} domain - Domain to refresh
 * @returns {Promise<boolean>} - True if refreshed successfully
 */
async function refreshCacheTTL(domain) {
  try {
    const key = getCacheKey(domain);
    const result = await redis.expire(key, CACHE_TTL);
    return result === 1;
  } catch (error) {
    console.error('Error refreshing cache TTL:', error);
    return false;
  }
}

module.exports = {
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
};
