# Rate Limiting & DDoS Protection

**Task:** 4.3.1 - Implement rate limiting and DDoS protection  
**Status:** Complete  
**Version:** 1.0

---

## Overview

The EduOS Platform implements comprehensive rate limiting and DDoS protection to safeguard the API from abuse, brute force attacks, and resource exhaustion. The system uses Redis-based sliding window algorithm for distributed rate limiting with support for IP blacklist/whitelist management.

---

## Features

### 1. Redis-Based Sliding Window Rate Limiting
- **Distributed:** Works across multiple server instances
- **Accurate:** Sliding window algorithm prevents burst attacks
- **Scalable:** Redis sorted sets for efficient counting
- **Automatic Cleanup:** Old entries automatically removed

### 2. Tiered Rate Limits
- **Public API:** 100 requests/minute per IP
- **Authenticated Users:** 1000 requests/minute per user
- **Authentication Endpoints:** 5 attempts/15 minutes
- **Password Reset:** 3 requests/hour
- **MFA Verification:** 10 attempts/15 minutes
- **Domain Verification:** 10 requests/hour

### 3. IP Access Control
- **Blacklist:** Block malicious IPs permanently or temporarily
- **Whitelist:** Bypass rate limits for trusted IPs
- **Dynamic Management:** Add/remove IPs via API
- **TTL Support:** Temporary blacklisting with auto-expiry

### 4. CDN Integration
- **Cloudflare:** Supports `CF-Connecting-IP` header
- **AWS CloudFront:** Supports `X-Forwarded-For` header
- **NGINX:** Supports `X-Real-IP` header
- **Fallback:** Uses socket IP when headers unavailable

### 5. Proper HTTP Responses
- **429 Status Code:** Too Many Requests
- **Retry-After Header:** Indicates when to retry
- **Standard Headers:** `RateLimit-Limit`, `RateLimit-Remaining`
- **Detailed Error Messages:** Clear guidance for clients

---

## Architecture

### Rate Limiting Flow

```
┌─────────────┐
│   Client    │
│   Request   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Extract Client IP                  │
│  • CF-Connecting-IP (Cloudflare)    │
│  • X-Forwarded-For (CloudFront)     │
│  • X-Real-IP (NGINX)                │
│  • req.ip (fallback)                │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Check Whitelist                    │
│  • If whitelisted → Allow           │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Check Blacklist                    │
│  • If blacklisted → 403 Forbidden   │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Redis Sliding Window Check         │
│  1. Remove old entries              │
│  2. Add current request             │
│  3. Count requests in window        │
│  4. Set expiry                      │
└──────┬──────────────────────────────┘
       │
       ├─── Count ≤ Limit ──────────────┐
       │                                 │
       │                                 ▼
       │                        ┌─────────────────┐
       │                        │  Allow Request  │
       │                        │  • Add headers  │
       │                        │  • Process      │
       │                        └─────────────────┘
       │
       └─── Count > Limit ──────────────┐
                                        │
                                        ▼
                               ┌─────────────────┐
                               │  429 Response   │
                               │  • Retry-After  │
                               │  • Error msg    │
                               └─────────────────┘
```

### Redis Data Structures

#### Rate Limit Counters (Sorted Sets)
```
Key: rl:public:ip:1.2.3.4
Members: timestamp-random (e.g., "1707321600000-0.123456")
Scores: timestamp (e.g., 1707321600000)
TTL: windowMs + 10 seconds
```

#### IP Blacklist (Set)
```
Key: ip:blacklist
Members: ["1.2.3.4", "5.6.7.8", ...]
```

#### IP Whitelist (Set)
```
Key: ip:whitelist
Members: ["9.10.11.12", "13.14.15.16", ...]
```

---

## Configuration

### Environment Variables

```bash
# Public API Rate Limits (requests per minute per IP)
PUBLIC_RATE_LIMIT=100

# Authenticated User Rate Limits (requests per minute per user)
AUTHENTICATED_RATE_LIMIT=1000

# Authentication Rate Limits (attempts per 15 minutes)
AUTH_RATE_LIMIT=5

# Password Reset Rate Limits (requests per hour)
PASSWORD_RESET_RATE_LIMIT=3

# MFA Rate Limits (attempts per 15 minutes)
MFA_RATE_LIMIT=10

# Domain Verification Rate Limits (requests per hour)
DOMAIN_VERIFICATION_RATE_LIMIT=10
```

### Redis Configuration

Ensure Redis is properly configured in `.env`:

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

---

## API Reference

### IP Access Control Endpoints

All endpoints require admin authentication.

#### Get Blacklist

```http
GET /api/v1/ip-access-control/blacklist
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "ips": ["1.2.3.4", "5.6.7.8"]
}
```

#### Get Whitelist

```http
GET /api/v1/ip-access-control/whitelist
```

**Response:**
```json
{
  "success": true,
  "count": 1,
  "ips": ["9.10.11.12"]
}
```

#### Add IP to Blacklist

```http
POST /api/v1/ip-access-control/blacklist
Content-Type: application/json

{
  "ip": "1.2.3.4",
  "ttl": 3600  // Optional: seconds until auto-removal
}
```

**Response:**
```json
{
  "success": true,
  "message": "IP 1.2.3.4 added to blacklist",
  "ip": "1.2.3.4",
  "ttl": 3600
}
```

#### Remove IP from Blacklist

```http
DELETE /api/v1/ip-access-control/blacklist/1.2.3.4
```

**Response:**
```json
{
  "success": true,
  "message": "IP 1.2.3.4 removed from blacklist",
  "ip": "1.2.3.4"
}
```

#### Add IP to Whitelist

```http
POST /api/v1/ip-access-control/whitelist
Content-Type: application/json

{
  "ip": "9.10.11.12"
}
```

**Response:**
```json
{
  "success": true,
  "message": "IP 9.10.11.12 added to whitelist",
  "ip": "9.10.11.12"
}
```

#### Remove IP from Whitelist

```http
DELETE /api/v1/ip-access-control/whitelist/9.10.11.12
```

**Response:**
```json
{
  "success": true,
  "message": "IP 9.10.11.12 removed from whitelist",
  "ip": "9.10.11.12"
}
```

#### Check IP Status

```http
GET /api/v1/ip-access-control/check/1.2.3.4
```

**Response:**
```json
{
  "success": true,
  "ip": "1.2.3.4",
  "blacklisted": false,
  "whitelisted": false,
  "status": "normal"  // "blocked", "allowed", or "normal"
}
```

---

## Rate Limit Response Format

When rate limit is exceeded, the API returns:

```http
HTTP/1.1 429 Too Many Requests
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 1707321660
Content-Type: application/json

{
  "error": "Too Many Requests",
  "message": "Too many requests from this IP. Please try again later.",
  "retryAfter": "60 seconds",
  "retryAfterSeconds": 60
}
```

---

## Usage Examples

### Apply Rate Limiting to Routes

```javascript
const express = require('express');
const { publicApiLimiter, authenticatedApiLimiter } = require('./middleware/rateLimiter');

const app = express();

// Apply public rate limiter to all API routes
app.use('/api', publicApiLimiter);

// Apply authenticated rate limiter to protected routes
app.use('/api/protected', authenticatedApiLimiter);
```

### Create Custom Rate Limiter

```javascript
const { createRateLimiter } = require('./middleware/rateLimiter');

const customLimiter = createRateLimiter({
  windowMs: 60000,        // 1 minute
  max: 50,                // 50 requests per window
  message: 'Custom rate limit exceeded',
  prefix: 'rl:custom:',
  skip: (req) => req.path === '/health'
});

app.use('/api/custom', customLimiter);
```

### Check Blacklist Middleware

```javascript
const { checkBlacklist } = require('./middleware/rateLimiter');

// Apply blacklist check before rate limiting
app.use(checkBlacklist);
app.use('/api', publicApiLimiter);
```

### Programmatic IP Management

```javascript
const { ipAccessControl } = require('./middleware/rateLimiter');

// Add IP to blacklist
await ipAccessControl.addToBlacklist('1.2.3.4');

// Add IP to blacklist with TTL (auto-remove after 1 hour)
await ipAccessControl.addToBlacklist('1.2.3.4', 3600);

// Remove IP from blacklist
await ipAccessControl.removeFromBlacklist('1.2.3.4');

// Add IP to whitelist
await ipAccessControl.addToWhitelist('9.10.11.12');

// Check IP status
const isBlacklisted = await ipAccessControl.isBlacklisted('1.2.3.4');
const isWhitelisted = await ipAccessControl.isWhitelisted('9.10.11.12');
```

---

## CDN Integration

### Cloudflare

Cloudflare automatically adds the `CF-Connecting-IP` header with the real client IP. No additional configuration needed.

```javascript
// Automatically detected
const ip = getClientIP(req); // Returns CF-Connecting-IP value
```

### AWS CloudFront

Configure CloudFront to forward the `X-Forwarded-For` header:

1. Go to CloudFront distribution settings
2. Edit Behavior
3. Under "Cache key and origin requests":
   - Select "Legacy cache settings"
   - Forward headers: "Whitelist"
   - Add "X-Forwarded-For"

### NGINX

Configure NGINX to set the `X-Real-IP` header:

```nginx
location / {
    proxy_pass http://backend;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

---

## Monitoring & Alerts

### Redis Monitoring

Monitor Redis performance for rate limiting:

```bash
# Check rate limit keys
redis-cli --scan --pattern "rl:*" | wc -l

# Check blacklist size
redis-cli SCARD ip:blacklist

# Check whitelist size
redis-cli SCARD ip:whitelist

# Monitor memory usage
redis-cli INFO memory
```

### Application Metrics

Track rate limiting metrics:

- **Rate limit hits:** Count of 429 responses
- **Blacklist blocks:** Count of 403 responses from blacklist
- **Top rate-limited IPs:** Identify potential attackers
- **Whitelist usage:** Monitor trusted IP activity

### Alerting

Set up alerts for:

- High rate of 429 responses (potential DDoS)
- Rapid blacklist growth (attack in progress)
- Redis connection failures (rate limiting disabled)
- Unusual whitelist additions (security breach)

---

## Security Best Practices

### 1. Regular Blacklist Review
- Review blacklisted IPs weekly
- Remove temporary blocks after investigation
- Document reasons for permanent blocks

### 2. Whitelist Management
- Limit whitelist to essential IPs only
- Use specific IPs, not ranges
- Audit whitelist changes regularly

### 3. Rate Limit Tuning
- Monitor legitimate user patterns
- Adjust limits based on usage data
- Consider different limits per tenant tier

### 4. CDN Configuration
- Always use CDN in production
- Enable DDoS protection at CDN level
- Configure proper header forwarding

### 5. Redis Security
- Use Redis password authentication
- Enable Redis persistence for blacklist/whitelist
- Monitor Redis memory usage
- Set up Redis replication for high availability

---

## Troubleshooting

### Issue: Rate limits not working

**Symptoms:** Requests not being rate limited

**Solutions:**
1. Check Redis connection: `redis-cli PING`
2. Verify environment variables are set
3. Check Redis keys: `redis-cli --scan --pattern "rl:*"`
4. Review application logs for Redis errors

### Issue: Legitimate users being blocked

**Symptoms:** Users reporting 429 errors

**Solutions:**
1. Check if IP is blacklisted: `GET /api/v1/ip-access-control/check/:ip`
2. Review rate limit configuration
3. Consider adding IP to whitelist
4. Increase rate limits for authenticated users

### Issue: CDN IP instead of client IP

**Symptoms:** All requests appear from same IP

**Solutions:**
1. Verify CDN header forwarding configuration
2. Check `getClientIP()` function logic
3. Test with curl: `curl -H "X-Forwarded-For: 1.2.3.4" http://api.example.com`

### Issue: Redis memory growing

**Symptoms:** Redis memory usage increasing

**Solutions:**
1. Check TTL on rate limit keys: `redis-cli TTL rl:public:ip:1.2.3.4`
2. Verify old entries are being cleaned up
3. Consider shorter window durations
4. Enable Redis maxmemory policy: `maxmemory-policy allkeys-lru`

---

## Performance Considerations

### Redis Pipeline

The rate limiter uses Redis pipelines for atomic operations:

```javascript
const pipeline = redis.pipeline();
pipeline.zremrangebyscore(key, 0, windowStart);
pipeline.zadd(key, now, `${now}-${Math.random()}`);
pipeline.zcard(key);
pipeline.expire(key, ttl);
const results = await pipeline.exec();
```

**Benefits:**
- Reduces network round trips
- Ensures atomicity
- Improves performance

### Memory Usage

Estimated Redis memory per rate limit key:

- **Sorted Set Overhead:** ~50 bytes
- **Per Entry:** ~100 bytes (timestamp + random)
- **100 requests/minute:** ~10 KB per IP
- **1000 active IPs:** ~10 MB

### Scalability

The system scales horizontally:

- Multiple application servers share Redis
- Redis Cluster for high availability
- CDN reduces load on origin servers

---

## Testing

### Unit Tests

Run rate limiter tests:

```bash
npm test -- src/middleware/rateLimiter.test.js
npm test -- src/routes/ipAccessControl.test.js
```

### Integration Tests

Test rate limiting end-to-end:

```bash
# Test public API rate limit
for i in {1..101}; do
  curl -w "%{http_code}\n" http://localhost:3000/api/test
done

# Test blacklist
curl -X POST http://localhost:3000/api/v1/ip-access-control/blacklist \
  -H "Content-Type: application/json" \
  -d '{"ip":"1.2.3.4"}'

curl http://localhost:3000/api/test \
  -H "X-Forwarded-For: 1.2.3.4"
# Should return 403
```

### Load Testing

Use Apache Bench or similar tools:

```bash
# Test rate limiting under load
ab -n 1000 -c 10 http://localhost:3000/api/test
```

---

## Migration from Old Rate Limiter

The new rate limiter is backward compatible. Old exports still work:

```javascript
// Old (still works)
const { apiLimiter } = require('./middleware/rateLimiter');

// New (recommended)
const { publicApiLimiter } = require('./middleware/rateLimiter');
```

To migrate:

1. Update imports to use new exports
2. Configure Redis connection
3. Set new environment variables
4. Test thoroughly in staging
5. Deploy to production

---

## Compliance

### GDPR Considerations

- IP addresses are personal data under GDPR
- Document retention policy for blacklist/whitelist
- Provide mechanism for users to request IP removal
- Log access to IP management endpoints

### Audit Trail

All IP access control changes are logged:

- Who added/removed IPs
- When changes were made
- Reason for changes (if provided)

---

## Future Enhancements

Potential improvements:

1. **Geographic Rate Limiting:** Different limits per country
2. **Adaptive Rate Limiting:** Adjust limits based on traffic patterns
3. **Machine Learning:** Detect anomalous behavior automatically
4. **Rate Limit Bypass Tokens:** Allow temporary limit increases
5. **Dashboard:** Visual interface for monitoring and management

---

## Support

For issues or questions:

- Check logs: `tail -f logs/app.log`
- Review Redis: `redis-cli MONITOR`
- Contact: security@eduos.com

---

**Last Updated:** 2026-02-07  
**Version:** 1.0  
**Task:** 4.3.1 - Implement rate limiting and DDoS protection
