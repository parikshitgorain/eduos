# Performance Optimization Guide

**Task:** 4.4.4 - Setup performance optimization and caching  
**Version:** 1.0  
**Last Updated:** 2026-02-08

---

## Overview

This guide documents the performance optimization strategies implemented in the EduOS Platform to achieve:
- **API Response Time:** p95 < 200ms, p99 < 500ms
- **Concurrent Users:** 10,000+ simultaneous users
- **Cache Hit Rate:** > 95%
- **Database Query Performance:** < 50ms for 95% of queries

---

## Table of Contents

1. [Caching Strategy](#caching-strategy)
2. [Database Optimization](#database-optimization)
3. [CDN Integration](#cdn-integration)
4. [Load Testing](#load-testing)
5. [Performance Monitoring](#performance-monitoring)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Caching Strategy

### Redis Caching Layers

The platform implements multi-layer caching using Redis:

#### 1. Schema Snapshot Cache
- **TTL:** 1 hour (immutable data)
- **Key Pattern:** `schema:snapshot:{snapshotId}`
- **Use Case:** Historical form rendering
- **Invalidation:** Never (immutable)

```javascript
const snapshot = await cacheService.getSchemaSnapshot(snapshotId);
```

#### 2. Active Schema Cache
- **TTL:** 5 minutes
- **Key Pattern:** `schema:active:{tenantId}:{entityType}`
- **Use Case:** Current form definitions
- **Invalidation:** On schema updates

```javascript
const schema = await cacheService.getActiveSchema(tenantId, 'student');
```

#### 3. Hierarchy Cache
- **TTL:** 10 minutes
- **Key Patterns:**
  - `hierarchy:node:{nodeId}`
  - `hierarchy:children:{tenantId}:{parentId}`
  - `hierarchy:ancestors:{nodeId}`
- **Use Case:** Organizational structure navigation
- **Invalidation:** On hierarchy changes

```javascript
const children = await cacheService.getHierarchyChildren(parentId, tenantId);
const ancestors = await cacheService.getHierarchyAncestors(nodeId);
```

#### 4. Domain Mapping Cache
- **TTL:** 5 minutes
- **Key Pattern:** `domain:mapping:{domain}`
- **Use Case:** Tenant resolution
- **Invalidation:** On domain configuration changes

```javascript
const mapping = await cacheService.getDomainMapping('school.example.com');
```

#### 5. Session Cache
- **TTL:** 1 hour (sliding expiration)
- **Key Pattern:** `session:{sessionId}`
- **Use Case:** User authentication state
- **Invalidation:** On logout or security events

### Cache Warming

Proactively load frequently accessed data into cache:

```javascript
// Warm cache on tenant creation or server startup
await cacheService.warmCache(tenantId);
```

### Cache Invalidation Strategies

#### 1. Time-Based (TTL)
Automatic expiration after specified duration.

#### 2. Event-Based
Explicit invalidation on data changes:

```javascript
// After schema update
await cacheService.invalidateSchemaCache(tenantId, entityType);

// After hierarchy change
await cacheService.invalidateHierarchyCache(nodeId, tenantId);

// After domain configuration
await cacheService.invalidateDomainCache(domain);
```

#### 3. Cache-Aside Pattern
Application checks cache first, falls back to database:

```javascript
const data = await cacheService.getOrSet(
  key,
  async () => {
    // Fallback to database
    const result = await query('SELECT * FROM table WHERE id = $1', [id]);
    return result.rows[0];
  },
  ttl
);
```

### Cache Monitoring

Track cache performance:

```javascript
const stats = cacheService.getCacheStats();
console.log(stats);
// {
//   hits: 9500,
//   misses: 500,
//   errors: 0,
//   total: 10000,
//   hitRate: '95.00%'
// }
```

---

## Database Optimization

### Index Strategy

Migration 024 creates indexes on frequently queried columns:

#### Schema Indexes
```sql
CREATE INDEX idx_schema_snapshots_id ON schema_snapshots(id);
CREATE INDEX idx_schemas_tenant_entity_active ON schemas(tenant_id, entity_type, is_active);
```

#### Hierarchy Indexes
```sql
CREATE INDEX idx_hierarchy_nodes_parent_tenant ON hierarchy_nodes(parent_id, tenant_id);
CREATE INDEX idx_hierarchy_nodes_level ON hierarchy_nodes(tenant_id, level);
```

#### Student Indexes
```sql
CREATE INDEX idx_students_duplicate_check ON students(tenant_id, first_name, last_name, date_of_birth);
CREATE INDEX idx_students_email ON students(tenant_id, email);
```

#### Attendance Indexes
```sql
CREATE INDEX idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX idx_attendance_idempotency ON attendance(idempotency_key);
```

#### Payment Indexes
```sql
CREATE INDEX idx_payments_tenant_status ON payments(tenant_id, status, created_at);
CREATE INDEX idx_payments_gateway_ref ON payments(gateway_reference);
```

#### Audit Log Indexes
```sql
CREATE INDEX idx_audit_logs_tenant_timestamp ON audit_logs(tenant_id, timestamp DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, timestamp DESC);
```

### Query Optimization

#### 1. Use Prepared Statements
```javascript
// Good: Parameterized query
const result = await query(
  'SELECT * FROM students WHERE tenant_id = $1 AND email = $2',
  [tenantId, email]
);

// Bad: String concatenation (SQL injection risk + no query plan caching)
const result = await query(
  `SELECT * FROM students WHERE tenant_id = '${tenantId}' AND email = '${email}'`
);
```

#### 2. Limit Result Sets
```javascript
// Always use LIMIT for pagination
const result = await query(
  'SELECT * FROM students WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
  [tenantId, limit, offset]
);
```

#### 3. Use Covering Indexes
```sql
-- Index includes all columns needed for query
CREATE INDEX idx_students_email_name ON students(tenant_id, email) INCLUDE (first_name, last_name);
```

#### 4. Avoid N+1 Queries
```javascript
// Bad: N+1 queries
const students = await query('SELECT * FROM students WHERE tenant_id = $1', [tenantId]);
for (const student of students.rows) {
  const enrollments = await query('SELECT * FROM enrollments WHERE student_id = $1', [student.id]);
}

// Good: Single JOIN query
const result = await query(`
  SELECT s.*, e.*
  FROM students s
  LEFT JOIN enrollments e ON s.id = e.student_id
  WHERE s.tenant_id = $1
`, [tenantId]);
```

#### 5. Use Connection Pooling
```javascript
// Configured in src/config/database.js
const poolConfig = {
  max: 20, // Maximum connections
  min: 2,  // Minimum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};
```

### Query Performance Monitoring

#### Analyze Slow Queries
```sql
-- View slow queries
SELECT * FROM analyze_query_performance();
```

#### Check Index Usage
```sql
-- View index usage statistics
SELECT * FROM check_index_usage();
```

#### Explain Query Plans
```sql
-- Analyze query execution plan
EXPLAIN ANALYZE
SELECT * FROM students
WHERE tenant_id = 'tenant-123' AND email = 'student@example.com';
```

### Database Maintenance

#### Regular VACUUM
```sql
-- Reclaim storage and update statistics
VACUUM ANALYZE students;
VACUUM ANALYZE enrollments;
VACUUM ANALYZE attendance;
```

#### Update Statistics
```sql
-- Update query planner statistics
ANALYZE students;
ANALYZE enrollments;
```

---

## CDN Integration

See [CDN Integration Guide](./CDN_INTEGRATION.md) for detailed setup instructions.

### Quick Setup

1. **Configure CDN URL**
```bash
# .env
CDN_ENABLED=true
CDN_URL=https://cdn.eduos.example.com
```

2. **Serve Static Assets**
```javascript
app.use('/static', express.static('public/static', {
  maxAge: '1y',
  immutable: true,
}));
```

3. **Use CDN in Templates**
```html
<link rel="stylesheet" href="<%= cdn('/static/css/main.css') %>">
<script src="<%= cdn('/static/js/app.js') %>"></script>
```

---

## Load Testing

### Running Load Tests

```bash
# Basic load test (100 users, 60 seconds)
node scripts/load-test.js --scenario=basic

# Load test (1000 users, 5 minutes)
node scripts/load-test.js --scenario=load

# Stress test (5000 users, 10 minutes)
node scripts/load-test.js --scenario=stress

# Spike test (10000 users, 60 seconds)
node scripts/load-test.js --scenario=spike

# Custom test
node scripts/load-test.js --scenario=basic --users=500 --duration=120
```

### Interpreting Results

```
RESULTS
=======
Test Duration: 60.00s

Requests:
  Total: 15000
  Successful: 14850
  Failed: 150
  Success Rate: 99.00%
  Throughput: 250.00 req/s

Response Times:
  Min: 12.50ms
  Max: 450.00ms
  Avg: 85.30ms
  p50: 75.00ms
  p95: 180.00ms ✅ PASS
  p99: 420.00ms ✅ PASS

Performance Targets:
  p95 Target: < 200ms
  p95 Actual: 180.00ms ✅ PASS
  p99 Target: < 500ms
  p99 Actual: 420.00ms ✅ PASS
```

### Performance Targets

- **p95 < 200ms:** 95% of requests complete in under 200ms
- **p99 < 500ms:** 99% of requests complete in under 500ms
- **Success Rate > 99%:** Less than 1% error rate
- **Throughput:** System handles expected load

---

## Performance Monitoring

### Real-Time Metrics

The platform tracks performance metrics automatically:

```javascript
// Add performance middleware
const { performanceMiddleware } = require('./middleware/performanceMiddleware');
app.use(performanceMiddleware);
```

### View Metrics

```bash
# Get daily metrics
GET /api/v1/metrics?date=2026-02-08

# Get endpoint-specific metrics
GET /api/v1/metrics/endpoint?method=GET&path=/api/v1/students

# Get slow endpoints
GET /api/v1/metrics/slow-endpoints?limit=10
```

### Response Format

```json
{
  "date": "2026-02-08",
  "requests": {
    "total": 50000,
    "status_2xx": 49500,
    "status_4xx": 400,
    "status_5xx": 100,
    "successRate": "99.00%"
  },
  "responseTimes": {
    "avg": "95.50ms",
    "p50": "80.00ms",
    "p95": "185.00ms",
    "p99": "450.00ms"
  },
  "performance": {
    "slowRequests": 2500,
    "verySlowRequests": 500,
    "slowRequestRate": "5.00%"
  },
  "targets": {
    "p95Target": "200ms",
    "p95Met": "✅ PASS",
    "p99Target": "500ms",
    "p99Met": "✅ PASS"
  }
}
```

### Alerting

Set up alerts for performance degradation:

```javascript
// Monitor p95 response time
if (metrics.responseTimes.p95 > 200) {
  alert('P95 response time exceeded target');
}

// Monitor error rate
if (metrics.requests.status_5xx / metrics.requests.total > 0.01) {
  alert('Error rate exceeded 1%');
}

// Monitor cache hit rate
if (cacheStats.hitRate < 95) {
  alert('Cache hit rate below 95%');
}
```

---

## Best Practices

### 1. Cache Frequently Accessed Data

```javascript
// Cache expensive computations
const result = await cacheService.getOrSet(
  `report:${tenantId}:${date}`,
  async () => {
    return await generateExpensiveReport(tenantId, date);
  },
  3600 // 1 hour
);
```

### 2. Use Pagination

```javascript
// Always paginate large result sets
const limit = 50;
const offset = (page - 1) * limit;

const result = await query(
  'SELECT * FROM students WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
  [tenantId, limit, offset]
);
```

### 3. Implement Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests, please try again later',
});

app.use('/api/', limiter);
```

### 4. Compress Responses

```javascript
const compression = require('compression');
app.use(compression());
```

### 5. Use Async/Await Properly

```javascript
// Good: Parallel execution
const [students, teachers, courses] = await Promise.all([
  getStudents(tenantId),
  getTeachers(tenantId),
  getCourses(tenantId),
]);

// Bad: Sequential execution
const students = await getStudents(tenantId);
const teachers = await getTeachers(tenantId);
const courses = await getCourses(tenantId);
```

### 6. Optimize Images

- Use modern formats (WebP, AVIF)
- Implement lazy loading
- Serve responsive images
- Compress images before upload

### 7. Minimize Bundle Size

- Code splitting
- Tree shaking
- Minification
- Remove unused dependencies

---

## Troubleshooting

### Issue: High Response Times

**Symptoms:**
- p95 > 200ms
- p99 > 500ms

**Diagnosis:**
```bash
# Check slow endpoints
GET /api/v1/metrics/slow-endpoints

# Analyze database queries
SELECT * FROM analyze_query_performance();
```

**Solutions:**
- Add missing indexes
- Optimize slow queries
- Increase cache TTL
- Scale horizontally

### Issue: Low Cache Hit Rate

**Symptoms:**
- Cache hit rate < 95%

**Diagnosis:**
```javascript
const stats = cacheService.getCacheStats();
console.log(stats.hitRate);
```

**Solutions:**
- Increase cache TTL
- Warm cache proactively
- Review cache invalidation logic
- Check Redis memory limits

### Issue: Database Connection Pool Exhaustion

**Symptoms:**
- Connection timeout errors
- Slow query execution

**Diagnosis:**
```javascript
console.log(pool.totalCount); // Total connections
console.log(pool.idleCount);  // Idle connections
console.log(pool.waitingCount); // Waiting requests
```

**Solutions:**
- Increase pool size
- Fix connection leaks
- Optimize long-running queries
- Implement connection timeout

### Issue: Memory Leaks

**Symptoms:**
- Increasing memory usage over time
- Out of memory errors

**Diagnosis:**
```bash
# Monitor memory usage
node --inspect src/server.js

# Take heap snapshot
# Chrome DevTools > Memory > Take Snapshot
```

**Solutions:**
- Fix event listener leaks
- Clear intervals/timeouts
- Limit cache size
- Implement memory limits

---

## Performance Checklist

- [ ] Redis caching implemented for:
  - [ ] Schema snapshots
  - [ ] Hierarchy lookups
  - [ ] Session data
  - [ ] Domain mappings
- [ ] Database indexes created on:
  - [ ] Frequently queried columns
  - [ ] Foreign keys
  - [ ] Composite keys for common queries
- [ ] CDN configured for:
  - [ ] Static assets (JS, CSS, images)
  - [ ] Cache headers set correctly
  - [ ] Cache invalidation implemented
- [ ] Load testing completed:
  - [ ] Basic scenario (100 users)
  - [ ] Load scenario (1000 users)
  - [ ] Stress scenario (5000 users)
  - [ ] Spike scenario (10000 users)
- [ ] Performance targets met:
  - [ ] p95 < 200ms
  - [ ] p99 < 500ms
  - [ ] Cache hit rate > 95%
  - [ ] Success rate > 99%
- [ ] Monitoring enabled:
  - [ ] Performance middleware active
  - [ ] Metrics endpoint available
  - [ ] Alerts configured
  - [ ] Dashboards created

---

## Next Steps

1. Run migration 024 to create performance indexes
2. Configure Redis caching in application
3. Set up CDN for static assets
4. Run load tests to validate performance
5. Monitor metrics and optimize as needed

---

**Related Documentation:**
- [CDN Integration Guide](./CDN_INTEGRATION.md)
- [Caching Strategy](./CACHING_STRATEGY.md)
- [Database Optimization](./DATABASE_OPTIMIZATION.md)
- [Load Testing Guide](./LOAD_TESTING.md)
