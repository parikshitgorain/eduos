/**
 * Cache Service
 * 
 * Centralized caching layer for performance optimization.
 * Implements caching strategies for:
 * - Schema snapshots
 * - Hierarchy lookups
 * - Session data
 * - Domain mappings
 * 
 * Task: 4.4.4 - Setup performance optimization and caching
 * 
 * Features:
 * - TTL-based expiration
 * - Cache invalidation
 * - Cache warming
 * - Hit rate monitoring
 * - Fallback to database on cache miss
 */

const { redis } = require('../config/redis');
const { query } = require('../config/database');

// Cache key prefixes
const CACHE_KEYS = {
  SCHEMA_SNAPSHOT: 'schema:snapshot:',
  SCHEMA_ACTIVE: 'schema:active:',
  HIERARCHY_NODE: 'hierarchy:node:',
  HIERARCHY_CHILDREN: 'hierarchy:children:',
  HIERARCHY_ANCESTORS: 'hierarchy:ancestors:',
  DOMAIN_MAPPING: 'domain:mapping:',
  SESSION: 'session:',
  PERMISSION_CACHE: 'permission:',
};

// Cache TTL values (in seconds)
const CACHE_TTL = {
  SCHEMA_SNAPSHOT: 3600, // 1 hour (immutable)
  SCHEMA_ACTIVE: 300, // 5 minutes
  HIERARCHY: 600, // 10 minutes
  DOMAIN_MAPPING: 300, // 5 minutes
  SESSION: 3600, // 1 hour (sliding)
  PERMISSION: 300, // 5 minutes
};

// Cache statistics
let cacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
};

/**
 * Get cache statistics
 * @returns {Object} Cache hit rate and statistics
 */
function getCacheStats() {
  const total = cacheStats.hits + cacheStats.misses;
  const hitRate = total > 0 ? (cacheStats.hits / total) * 100 : 0;
  
  return {
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    errors: cacheStats.errors,
    total,
    hitRate: hitRate.toFixed(2) + '%',
  };
}

/**
 * Reset cache statistics
 */
function resetCacheStats() {
  cacheStats = { hits: 0, misses: 0, errors: 0 };
}

/**
 * Generic cache get with fallback
 * @param {string} key - Cache key
 * @param {Function} fallback - Async function to fetch data on cache miss
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<any>}
 */
async function getOrSet(key, fallback, ttl = 300) {
  try {
    // Try to get from cache
    const cached = await redis.get(key);
    
    if (cached) {
      cacheStats.hits++;
      return JSON.parse(cached);
    }
    
    // Cache miss - fetch from source
    cacheStats.misses++;
    const data = await fallback();
    
    if (data !== null && data !== undefined) {
      // Store in cache
      await redis.setex(key, ttl, JSON.stringify(data));
    }
    
    return data;
  } catch (error) {
    cacheStats.errors++;
    console.error('Cache error:', error);
    // Fallback to direct fetch on cache error
    return await fallback();
  }
}

/**
 * Cache schema snapshot
 * @param {string} snapshotId - Schema snapshot ID
 * @param {Object} snapshot - Snapshot data
 * @param {number} ttl - Time to live (default: 1 hour)
 * @returns {Promise<void>}
 */
async function cacheSchemaSnapshot(snapshotId, snapshot, ttl = CACHE_TTL.SCHEMA_SNAPSHOT) {
  const key = CACHE_KEYS.SCHEMA_SNAPSHOT + snapshotId;
  await redis.setex(key, ttl, JSON.stringify(snapshot));
}

/**
 * Get schema snapshot from cache or database
 * @param {string} snapshotId - Schema snapshot ID
 * @returns {Promise<Object|null>}
 */
async function getSchemaSnapshot(snapshotId) {
  const key = CACHE_KEYS.SCHEMA_SNAPSHOT + snapshotId;
  
  return await getOrSet(
    key,
    async () => {
      const result = await query(
        'SELECT * FROM schema_snapshots WHERE id = $1',
        [snapshotId]
      );
      return result.rows[0] || null;
    },
    CACHE_TTL.SCHEMA_SNAPSHOT
  );
}

/**
 * Get active schema for a tenant
 * @param {string} tenantId - Tenant ID
 * @param {string} entityType - Entity type (e.g., 'student', 'teacher')
 * @returns {Promise<Object|null>}
 */
async function getActiveSchema(tenantId, entityType) {
  const key = `${CACHE_KEYS.SCHEMA_ACTIVE}${tenantId}:${entityType}`;
  
  return await getOrSet(
    key,
    async () => {
      const result = await query(
        `SELECT ss.* FROM schema_snapshots ss
         JOIN schemas s ON ss.schema_id = s.id
         WHERE s.tenant_id = $1 AND s.entity_type = $2 AND s.is_active = true
         ORDER BY ss.created_at DESC
         LIMIT 1`,
        [tenantId, entityType]
      );
      return result.rows[0] || null;
    },
    CACHE_TTL.SCHEMA_ACTIVE
  );
}

/**
 * Invalidate schema cache for a tenant
 * @param {string} tenantId - Tenant ID
 * @param {string} entityType - Entity type (optional)
 * @returns {Promise<void>}
 */
async function invalidateSchemaCache(tenantId, entityType = null) {
  if (entityType) {
    const key = `${CACHE_KEYS.SCHEMA_ACTIVE}${tenantId}:${entityType}`;
    await redis.del(key);
  } else {
    // Invalidate all schemas for tenant
    const pattern = `${CACHE_KEYS.SCHEMA_ACTIVE}${tenantId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

/**
 * Get hierarchy node from cache or database
 * @param {string} nodeId - Node ID
 * @returns {Promise<Object|null>}
 */
async function getHierarchyNode(nodeId) {
  const key = CACHE_KEYS.HIERARCHY_NODE + nodeId;
  
  return await getOrSet(
    key,
    async () => {
      const result = await query(
        `SELECT * FROM hierarchy_nodes WHERE id = $1`,
        [nodeId]
      );
      return result.rows[0] || null;
    },
    CACHE_TTL.HIERARCHY
  );
}

/**
 * Get hierarchy children from cache or database
 * @param {string} parentId - Parent node ID
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Array>}
 */
async function getHierarchyChildren(parentId, tenantId) {
  const key = `${CACHE_KEYS.HIERARCHY_CHILDREN}${tenantId}:${parentId}`;
  
  return await getOrSet(
    key,
    async () => {
      const result = await query(
        `SELECT * FROM hierarchy_nodes 
         WHERE parent_id = $1 AND tenant_id = $2
         ORDER BY name`,
        [parentId, tenantId]
      );
      return result.rows;
    },
    CACHE_TTL.HIERARCHY
  );
}

/**
 * Get hierarchy ancestors from cache or database
 * @param {string} nodeId - Node ID
 * @returns {Promise<Array>}
 */
async function getHierarchyAncestors(nodeId) {
  const key = CACHE_KEYS.HIERARCHY_ANCESTORS + nodeId;
  
  return await getOrSet(
    key,
    async () => {
      const result = await query(
        `WITH RECURSIVE ancestors AS (
          SELECT id, parent_id, name, level, tenant_id
          FROM hierarchy_nodes
          WHERE id = $1
          
          UNION ALL
          
          SELECT hn.id, hn.parent_id, hn.name, hn.level, hn.tenant_id
          FROM hierarchy_nodes hn
          INNER JOIN ancestors a ON hn.id = a.parent_id
        )
        SELECT * FROM ancestors ORDER BY level`,
        [nodeId]
      );
      return result.rows;
    },
    CACHE_TTL.HIERARCHY
  );
}

/**
 * Invalidate hierarchy cache for a node and its descendants
 * @param {string} nodeId - Node ID
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<void>}
 */
async function invalidateHierarchyCache(nodeId, tenantId) {
  // Invalidate node cache
  await redis.del(CACHE_KEYS.HIERARCHY_NODE + nodeId);
  
  // Invalidate children cache
  const childrenKey = `${CACHE_KEYS.HIERARCHY_CHILDREN}${tenantId}:${nodeId}`;
  await redis.del(childrenKey);
  
  // Invalidate ancestors cache
  await redis.del(CACHE_KEYS.HIERARCHY_ANCESTORS + nodeId);
  
  // Invalidate parent's children cache
  const node = await query('SELECT parent_id FROM hierarchy_nodes WHERE id = $1', [nodeId]);
  if (node.rows[0]?.parent_id) {
    const parentChildrenKey = `${CACHE_KEYS.HIERARCHY_CHILDREN}${tenantId}:${node.rows[0].parent_id}`;
    await redis.del(parentChildrenKey);
  }
}

/**
 * Get domain mapping from cache or database
 * @param {string} domain - Domain name
 * @returns {Promise<Object|null>}
 */
async function getDomainMapping(domain) {
  const key = CACHE_KEYS.DOMAIN_MAPPING + domain;
  
  return await getOrSet(
    key,
    async () => {
      const result = await query(
        `SELECT tenant_id, domain, is_verified, is_primary
         FROM tenant_domains
         WHERE domain = $1 AND is_verified = true`,
        [domain]
      );
      return result.rows[0] || null;
    },
    CACHE_TTL.DOMAIN_MAPPING
  );
}

/**
 * Invalidate domain mapping cache
 * @param {string} domain - Domain name
 * @returns {Promise<void>}
 */
async function invalidateDomainCache(domain) {
  const key = CACHE_KEYS.DOMAIN_MAPPING + domain;
  await redis.del(key);
}

/**
 * Warm up cache with frequently accessed data
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<void>}
 */
async function warmCache(tenantId) {
  try {
    console.log(`Warming cache for tenant: ${tenantId}`);
    
    // Warm up active schemas
    const entityTypes = ['student', 'teacher', 'course', 'enrollment'];
    for (const entityType of entityTypes) {
      await getActiveSchema(tenantId, entityType);
    }
    
    // Warm up hierarchy root nodes
    const rootNodes = await query(
      'SELECT id FROM hierarchy_nodes WHERE tenant_id = $1 AND parent_id IS NULL',
      [tenantId]
    );
    
    for (const node of rootNodes.rows) {
      await getHierarchyNode(node.id);
      await getHierarchyChildren(node.id, tenantId);
    }
    
    console.log(`Cache warmed for tenant: ${tenantId}`);
  } catch (error) {
    console.error('Cache warming error:', error);
  }
}

/**
 * Clear all cache for a tenant
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<void>}
 */
async function clearTenantCache(tenantId) {
  const patterns = [
    `${CACHE_KEYS.SCHEMA_ACTIVE}${tenantId}:*`,
    `${CACHE_KEYS.HIERARCHY_CHILDREN}${tenantId}:*`,
  ];
  
  for (const pattern of patterns) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

/**
 * Get cache key for custom caching
 * @param {string} prefix - Key prefix
 * @param {string} identifier - Unique identifier
 * @returns {string}
 */
function getCacheKey(prefix, identifier) {
  return `${prefix}${identifier}`;
}

module.exports = {
  // Cache operations
  getOrSet,
  getCacheKey,
  
  // Schema caching
  cacheSchemaSnapshot,
  getSchemaSnapshot,
  getActiveSchema,
  invalidateSchemaCache,
  
  // Hierarchy caching
  getHierarchyNode,
  getHierarchyChildren,
  getHierarchyAncestors,
  invalidateHierarchyCache,
  
  // Domain caching
  getDomainMapping,
  invalidateDomainCache,
  
  // Cache management
  warmCache,
  clearTenantCache,
  
  // Statistics
  getCacheStats,
  resetCacheStats,
  
  // Constants
  CACHE_KEYS,
  CACHE_TTL,
};
