# Domain Routing Cache Layer

**Task:** 1.2.3 - Create tenant routing cache layer  
**Status:** Complete  
**Last Updated:** 2026-02-05

---

## Overview

The Domain Routing Cache Layer is a Redis-based caching system that stores domain-to-tenant mappings to optimize domain resolution performance. This layer sits between the domain mapping middleware and the PostgreSQL database, providing sub-millisecond lookup times for frequently accessed domains.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Domain Mapping Flow                          │
└─────────────────────────────────────────────────────────────────┘

Request with Host Header
         │
         ▼
┌─────────────────────┐
│ Extract Domain      │
│ (middleware)        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Check Redis Cache   │◄──── Cache Hit (< 1ms)
│ (domainCacheService)│
└──────────┬──────────┘
           │
           │ Cache Miss
           ▼
┌─────────────────────┐
│ Query PostgreSQL    │◄──── Database Query (5-50ms)
│ (resolve_domain)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Cache Result        │
│ (TTL: 5 minutes)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Attach to Request   │
│ Continue Processing │
└─────────────────────┘
```

---

## Key Features

### 1. Redis-Based Caching
- **Storage:** Domain → Tenant mappings stored in Redis
- **TTL:** 5 minutes (300 seconds) with automatic expiration
- **Key Format:** `domain:{domain_name}` (e.g., `domain:school.eduos.com`)
- **Value Format:** JSON with tenant information and metadata

### 2. Cache Invalidation
- **Manual Invalidation:** API endpoints for clearing specific domains
- **Tenant-Wide Invalidation:** Clear all domains for a specific tenant
- **Automatic Invalidation:** Triggered on domain configuration changes
- **Global Clear:** Admin endpoint to clear entire cache

### 3. Performance Monitoring
- **Hit Rate Tracking:** Real-time cache hit/miss statistics
- **SLA Monitoring:** Target hit rate > 95%
- **Memory Usage:** Track Redis memory consumption
- **Latency Metrics:** Measure cache lookup performance

### 4. Cache Warmup
- **Bulk Loading:** Pre-populate cache with active domains
- **Startup Warmup:** Optional warmup on application start
- **Scheduled Warmup:** Periodic cache refresh for frequently accessed domains

---

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Cache Configuration (hardcoded in service)
CACHE_TTL=300  # 5 minutes in seconds
```

### Docker Compose

```yaml
redis:
  image: redis:7-alpine
  container_name: eduos_redis
  command: redis-server --appendonly yes
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
```

---

## API Endpoints

### Cache Statistics

**GET** `/api/v1/cache/stats`

Get cache performance statistics.

**Response:**
```json
{
  "totalEntries": 150,
  "hits": 9500,
  "misses": 500,
  "total": 10000,
  "hitRate": 95.0,
  "cacheTTL": 300,
  "memoryUsed": "2.5M",
  "timestamp": "2026-02-05T10:30:00.000Z",
  "meetsHitRateSLA": true,
  "slaThreshold": 95
}
```

### Invalidate Domain Cache

**POST** `/api/v1/cache/invalidate`

Invalidate cache for a specific domain.

**Request:**
```json
{
  "domain": "school.eduos.com"
}
```

**Response:**
```json
{
  "success": true,
  "domain": "school.eduos.com",
  "message": "Cache invalidated for domain: school.eduos.com"
}
```

### Invalidate Tenant Cache

**POST** `/api/v1/cache/invalidate-tenant`

Invalidate cache for all domains of a tenant.

**Request:**
```json
{
  "tenantId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "success": true,
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "domainsInvalidated": 3,
  "message": "Invalidated 3 domain(s) for tenant: 550e8400-e29b-41d4-a716-446655440000"
}
```

### Clear All Cache

**POST** `/api/v1/cache/clear`

Clear entire domain cache.

**Response:**
```json
{
  "success": true,
  "entriesCleared": 150,
  "message": "Cleared 150 cache entries"
}
```

### Reset Statistics

**POST** `/api/v1/cache/reset-stats`

Reset cache hit/miss counters.

**Response:**
```json
{
  "success": true,
  "message": "Cache statistics reset successfully"
}
```

### Warmup Cache

**POST** `/api/v1/cache/warmup`

Pre-populate cache with all active domains.

**Response:**
```json
{
  "success": true,
  "domainsCached": 150,
  "message": "Cache warmed up with 150 domains"
}
```

---

## Usage Examples

### Programmatic Cache Management

```javascript
const {
  getCachedTenant,
  cacheTenant,
  invalidateCache,
  getCacheStats
} = require('./services/domainCacheService');

// Get cached tenant
const tenant = await getCachedTenant('school.eduos.com');

// Cache tenant manually
await cacheTenant('school.eduos.com', {
  tenant_id: 'uuid',
  tenant_name: 'School Name',
  tenant_tier: 'Basic',
  tenant_status: 'active',
  domain_type: 'subdomain',
  is_verified: true
});

// Invalidate cache
await invalidateCache('school.eduos.com');

// Get statistics
const stats = await getCacheStats();
console.log(`Hit rate: ${stats.hitRate}%`);
```

### Automatic Cache Invalidation

Cache is automatically invalidated when:

1. **Domain Verification:** When a custom domain is verified
2. **Domain Deletion:** When a domain is removed
3. **Tenant Updates:** When tenant status changes (via API)

```javascript
// Example: Domain verification automatically invalidates cache
router.post('/:domainId/verify', async (req, res) => {
  // ... verification logic ...
  
  // Invalidate cache for this domain
  await invalidateCache(domainRecord.domain);
  
  res.json({ message: 'Domain verified successfully' });
});
```

---

## Performance Characteristics

### Latency

| Operation | Target | Typical |
|-----------|--------|---------|
| Cache Hit | < 1ms | 0.1-0.5ms |
| Cache Miss + DB Query | < 10ms | 5-8ms |
| Cache Write | < 1ms | 0.2-0.3ms |
| Cache Invalidation | < 1ms | 0.1-0.2ms |

### Hit Rate

- **Target:** > 95%
- **Typical:** 95-99% (after warmup)
- **Monitoring:** Real-time via `/api/v1/cache/stats`

### Memory Usage

- **Per Entry:** ~500 bytes (domain + tenant info)
- **1000 Domains:** ~500 KB
- **10,000 Domains:** ~5 MB
- **100,000 Domains:** ~50 MB

---

## Monitoring & Alerting

### Key Metrics

1. **Cache Hit Rate**
   - Alert if < 95% for 5 minutes
   - Indicates cache misses or TTL too short

2. **Cache Size**
   - Monitor total entries
   - Alert if exceeds expected capacity

3. **Memory Usage**
   - Track Redis memory consumption
   - Alert if > 80% of allocated memory

4. **Latency**
   - Monitor cache lookup time
   - Alert if p95 > 5ms

### Grafana Dashboard

```promql
# Cache hit rate
rate(domain_cache_hits_total[5m]) / 
(rate(domain_cache_hits_total[5m]) + rate(domain_cache_misses_total[5m])) * 100

# Cache size
domain_cache_entries_total

# Memory usage
redis_memory_used_bytes{job="redis"}
```

---

## Troubleshooting

### Low Hit Rate (< 95%)

**Possible Causes:**
1. TTL too short (domains expiring too quickly)
2. High rate of new domains being added
3. Cache being cleared too frequently
4. Redis connection issues

**Solutions:**
1. Increase TTL (requires code change)
2. Implement cache warmup on startup
3. Review cache invalidation logic
4. Check Redis health and connectivity

### High Memory Usage

**Possible Causes:**
1. Too many domains cached
2. Large tenant metadata
3. Memory leak in Redis

**Solutions:**
1. Reduce TTL to expire entries faster
2. Implement cache size limits
3. Monitor for memory leaks
4. Restart Redis if necessary

### Cache Inconsistency

**Possible Causes:**
1. Domain updated but cache not invalidated
2. Race condition between cache and database
3. Redis replication lag

**Solutions:**
1. Ensure all domain updates invalidate cache
2. Use cache-aside pattern (always check DB on critical operations)
3. Monitor Redis replication status

---

## Testing

### Unit Tests

```bash
# Run cache service tests
npm test -- --testPathPattern=domainCacheService.test.js

# Run with coverage
npm test -- --testPathPattern=domainCacheService.test.js --coverage
```

### Integration Tests

```bash
# Test with real Redis instance
REDIS_HOST=localhost npm test -- --testPathPattern=domainMapping.test.js
```

### Load Testing

```bash
# Test cache performance under load
# (requires load testing tool like Apache Bench or k6)
ab -n 10000 -c 100 http://localhost:3000/api/v1/domains
```

---

## Best Practices

### 1. Always Invalidate on Updates

```javascript
// ✅ Good: Invalidate cache after domain update
await updateDomain(domainId, updates);
await invalidateCache(domain);

// ❌ Bad: Update without invalidation
await updateDomain(domainId, updates);
```

### 2. Handle Cache Failures Gracefully

```javascript
// ✅ Good: Fallback to database on cache error
let tenant = await getCachedTenant(domain);
if (!tenant) {
  tenant = await resolveDomainToTenant(domain);
  await cacheTenant(domain, tenant);
}

// ❌ Bad: Fail request on cache error
const tenant = await getCachedTenant(domain);
if (!tenant) throw new Error('Cache miss');
```

### 3. Monitor Hit Rate

```javascript
// ✅ Good: Track and alert on hit rate
const stats = await getCacheStats();
if (stats.hitRate < 95) {
  console.warn('Cache hit rate below SLA:', stats.hitRate);
}
```

### 4. Warmup on Startup

```javascript
// ✅ Good: Pre-populate cache on startup
app.listen(PORT, async () => {
  console.log('Server started');
  await warmupCache();
  console.log('Cache warmed up');
});
```

---

## Future Enhancements

1. **Adaptive TTL:** Adjust TTL based on domain access patterns
2. **Cache Preloading:** Predictive cache loading based on usage patterns
3. **Distributed Caching:** Redis Cluster for horizontal scaling
4. **Cache Compression:** Reduce memory usage with compression
5. **Multi-Level Caching:** Add in-memory L1 cache for ultra-low latency

---

## References

- [Redis Documentation](https://redis.io/documentation)
- [ioredis Client](https://github.com/luin/ioredis)
- [Cache-Aside Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/cache-aside)
- [Task 1.2.1: Domain Mapping Middleware](./DOMAIN_MAPPING.md)
- [Task 1.2.2: Domain Verification Workflow](./DOMAIN_VERIFICATION_WORKFLOW.md)
