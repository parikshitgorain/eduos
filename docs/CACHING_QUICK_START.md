# Caching Quick Start Guide

**Task:** 4.4.4 - Setup performance optimization and caching  
**Version:** 1.0  
**Last Updated:** 2026-02-08

---

## Quick Reference

### Import Cache Service

```javascript
const cacheService = require('./services/cacheService');
```

---

## Common Use Cases

### 1. Cache Schema Snapshots

```javascript
// Get schema snapshot (auto-cached for 1 hour)
const snapshot = await cacheService.getSchemaSnapshot(snapshotId);

// Manually cache a snapshot
await cacheService.cacheSchemaSnapshot(snapshotId, snapshotData);
```

### 2. Cache Active Schemas

```javascript
// Get active schema for tenant (auto-cached for 5 minutes)
const schema = await cacheService.getActiveSchema(tenantId, 'student');

// Invalidate after schema update
await cacheService.invalidateSchemaCache(tenantId, 'student');
```

### 3. Cache Hierarchy Data

```javascript
// Get hierarchy node
const node = await cacheService.getHierarchyNode(nodeId);

// Get children
const children = await cacheService.getHierarchyChildren(parentId, tenantId);

// Get ancestors
const ancestors = await cacheService.getHierarchyAncestors(nodeId);

// Invalidate after hierarchy change
await cacheService.invalidateHierarchyCache(nodeId, tenantId);
```

### 4. Cache Domain Mappings

```javascript
// Get domain mapping (auto-cached for 5 minutes)
const mapping = await cacheService.getDomainMapping('school.example.com');

// Invalidate after domain configuration change
await cacheService.invalidateDomainCache('school.example.com');
```

### 5. Custom Caching

```javascript
// Cache any data with custom TTL
const data = await cacheService.getOrSet(
  'custom:key:123',
  async () => {
    // Fallback function - called on cache miss
    const result = await expensiveOperation();
    return result;
  },
  3600 // TTL in seconds (1 hour)
);
```

---

## Cache Management

### Warm Cache

```javascript
// Preload frequently accessed data for a tenant
await cacheService.warmCache(tenantId);
```

### Clear Cache

```javascript
// Clear all cache for a tenant
await cacheService.clearTenantCache(tenantId);
```

### Monitor Cache Performance

```javascript
// Get cache statistics
const stats = cacheService.getCacheStats();
console.log(stats);
// {
//   hits: 9500,
//   misses: 500,
//   errors: 0,
//   total: 10000,
//   hitRate: '95.00%'
// }

// Reset statistics
cacheService.resetCacheStats();
```

---

## Cache Keys

Use predefined cache key patterns:

```javascript
const { CACHE_KEYS } = cacheService;

// Available patterns:
CACHE_KEYS.SCHEMA_SNAPSHOT    // 'schema:snapshot:'
CACHE_KEYS.SCHEMA_ACTIVE      // 'schema:active:'
CACHE_KEYS.HIERARCHY_NODE     // 'hierarchy:node:'
CACHE_KEYS.HIERARCHY_CHILDREN // 'hierarchy:children:'
CACHE_KEYS.HIERARCHY_ANCESTORS // 'hierarchy:ancestors:'
CACHE_KEYS.DOMAIN_MAPPING     // 'domain:mapping:'
CACHE_KEYS.SESSION            // 'session:'
CACHE_KEYS.PERMISSION_CACHE   // 'permission:'
```

---

## Cache TTL Values

Default TTL values (in seconds):

```javascript
const { CACHE_TTL } = cacheService;

CACHE_TTL.SCHEMA_SNAPSHOT  // 3600 (1 hour)
CACHE_TTL.SCHEMA_ACTIVE    // 300 (5 minutes)
CACHE_TTL.HIERARCHY        // 600 (10 minutes)
CACHE_TTL.DOMAIN_MAPPING   // 300 (5 minutes)
CACHE_TTL.SESSION          // 3600 (1 hour)
CACHE_TTL.PERMISSION       // 300 (5 minutes)
```

---

## Best Practices

### 1. Always Use Cache for Immutable Data

```javascript
// Good: Schema snapshots are immutable
const snapshot = await cacheService.getSchemaSnapshot(snapshotId);

// Bad: Don't query database directly
const snapshot = await query('SELECT * FROM schema_snapshots WHERE id = $1', [snapshotId]);
```

### 2. Invalidate Cache on Updates

```javascript
// After updating schema
await updateSchema(tenantId, entityType, newSchema);
await cacheService.invalidateSchemaCache(tenantId, entityType);
```

### 3. Use Appropriate TTL

```javascript
// Short TTL for frequently changing data
await cacheService.getOrSet(key, fallback, 60); // 1 minute

// Long TTL for rarely changing data
await cacheService.getOrSet(key, fallback, 86400); // 1 day
```

### 4. Handle Cache Errors Gracefully

The cache service automatically falls back to database on errors:

```javascript
// No need for try-catch - fallback is automatic
const data = await cacheService.getOrSet(key, fallback, ttl);
```

### 5. Monitor Cache Hit Rate

```javascript
// Check cache performance regularly
const stats = cacheService.getCacheStats();
if (parseFloat(stats.hitRate) < 95) {
  console.warn('Cache hit rate below target:', stats.hitRate);
}
```

---

## Performance Monitoring

### Add Performance Middleware

```javascript
// src/server.js
const { performanceMiddleware } = require('./middleware/performanceMiddleware');

app.use(performanceMiddleware);
```

### View Performance Metrics

```bash
# Daily metrics
GET /api/v1/metrics?date=2026-02-08

# Endpoint metrics
GET /api/v1/metrics/endpoint?method=GET&path=/api/v1/students

# Slow endpoints
GET /api/v1/metrics/slow-endpoints?limit=10
```

---

## Load Testing

### Run Load Tests

```bash
# Basic test (100 users, 60 seconds)
node scripts/load-test.js --scenario=basic

# Load test (1000 users, 5 minutes)
node scripts/load-test.js --scenario=load

# Stress test (5000 users, 10 minutes)
node scripts/load-test.js --scenario=stress

# Spike test (10000 users, 60 seconds)
node scripts/load-test.js --scenario=spike
```

---

## Troubleshooting

### Low Cache Hit Rate

```javascript
// Check statistics
const stats = cacheService.getCacheStats();
console.log('Hit rate:', stats.hitRate);

// Possible causes:
// 1. TTL too short
// 2. Cache not being used
// 3. Too many cache invalidations
// 4. Redis memory limit reached
```

### Cache Not Working

```javascript
// Verify Redis connection
const { redis } = require('./config/redis');
const pong = await redis.ping();
console.log('Redis status:', pong); // Should be 'PONG'
```

### Slow Queries Despite Caching

```javascript
// Check if cache is being bypassed
const data = await cacheService.getOrSet(key, fallback, ttl);

// Verify cache key is correct
const key = cacheService.getCacheKey('prefix:', 'identifier');
```

---

## Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0

# CDN Configuration (optional)
CDN_ENABLED=true
CDN_URL=https://cdn.eduos.example.com
```

---

## Related Documentation

- [Performance Optimization Guide](./PERFORMANCE_OPTIMIZATION.md)
- [CDN Integration Guide](./CDN_INTEGRATION.md)
- [Load Testing Guide](./LOAD_TESTING.md)
- [Database Optimization](./DATABASE_OPTIMIZATION.md)

---

## Support

For issues or questions:
1. Check the [Performance Optimization Guide](./PERFORMANCE_OPTIMIZATION.md)
2. Review cache statistics: `cacheService.getCacheStats()`
3. Check Redis logs: `docker logs redis`
4. Monitor performance metrics: `GET /api/v1/metrics`
