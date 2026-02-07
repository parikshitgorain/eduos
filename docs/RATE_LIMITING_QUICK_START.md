# Rate Limiting & DDoS Protection - Quick Start Guide

**Task:** 4.3.1 - Implement rate limiting and DDoS protection  
**Time to Complete:** 10 minutes

---

## Prerequisites

- Redis server running
- Node.js application configured
- Environment variables set

---

## Quick Setup

### 1. Configure Environment Variables

Add to your `.env` file:

```bash
# Rate Limiting Configuration
PUBLIC_RATE_LIMIT=100
AUTHENTICATED_RATE_LIMIT=1000
AUTH_RATE_LIMIT=5
PASSWORD_RESET_RATE_LIMIT=3
MFA_RATE_LIMIT=10
DOMAIN_VERIFICATION_RATE_LIMIT=10

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### 2. Apply Rate Limiting to Your Routes

```javascript
const express = require('express');
const { publicApiLimiter, checkBlacklist } = require('./middleware/rateLimiter');

const app = express();

// Apply blacklist check globally
app.use(checkBlacklist);

// Apply rate limiting to API routes
app.use('/api', publicApiLimiter);

// Your routes here
app.get('/api/data', (req, res) => {
  res.json({ message: 'Protected by rate limiting' });
});
```

### 3. Add IP Access Control Routes (Optional)

```javascript
const ipAccessControlRoutes = require('./routes/ipAccessControl');
app.use('/api/v1/ip-access-control', ipAccessControlRoutes);
```

### 4. Test Rate Limiting

```bash
# Test normal request
curl http://localhost:3000/api/data

# Test rate limit (make 101 requests quickly)
for i in {1..101}; do
  curl -w "%{http_code}\n" http://localhost:3000/api/data
done
# Last request should return 429
```

---

## Common Use Cases

### Block an Abusive IP

```bash
curl -X POST http://localhost:3000/api/v1/ip-access-control/blacklist \
  -H "Content-Type: application/json" \
  -d '{"ip":"1.2.3.4"}'
```

### Whitelist a Trusted IP

```bash
curl -X POST http://localhost:3000/api/v1/ip-access-control/whitelist \
  -H "Content-Type: application/json" \
  -d '{"ip":"9.10.11.12"}'
```

### Check IP Status

```bash
curl http://localhost:3000/api/v1/ip-access-control/check/1.2.3.4
```

### Temporary Blacklist (Auto-Remove After 1 Hour)

```bash
curl -X POST http://localhost:3000/api/v1/ip-access-control/blacklist \
  -H "Content-Type: application/json" \
  -d '{"ip":"1.2.3.4","ttl":3600}'
```

---

## Monitoring

### Check Redis Rate Limit Keys

```bash
redis-cli --scan --pattern "rl:*" | wc -l
```

### View Blacklist

```bash
redis-cli SMEMBERS ip:blacklist
```

### View Whitelist

```bash
redis-cli SMEMBERS ip:whitelist
```

### Monitor Rate Limit Activity

```bash
redis-cli MONITOR | grep "rl:"
```

---

## Troubleshooting

### Rate Limiting Not Working?

1. **Check Redis connection:**
   ```bash
   redis-cli PING
   # Should return: PONG
   ```

2. **Verify environment variables:**
   ```bash
   echo $PUBLIC_RATE_LIMIT
   ```

3. **Check application logs:**
   ```bash
   tail -f logs/app.log | grep "rate limit"
   ```

### Getting 429 Errors?

1. **Check if IP is blacklisted:**
   ```bash
   curl http://localhost:3000/api/v1/ip-access-control/check/YOUR_IP
   ```

2. **Wait for rate limit window to reset** (1 minute for public API)

3. **Add IP to whitelist if legitimate:**
   ```bash
   curl -X POST http://localhost:3000/api/v1/ip-access-control/whitelist \
     -H "Content-Type: application/json" \
     -d '{"ip":"YOUR_IP"}'
   ```

---

## CDN Integration

### Cloudflare

No configuration needed! The system automatically detects `CF-Connecting-IP` header.

### AWS CloudFront

1. Edit CloudFront distribution behavior
2. Under "Cache key and origin requests":
   - Select "Legacy cache settings"
   - Forward headers: "Whitelist"
   - Add "X-Forwarded-For"

### NGINX

Add to your NGINX configuration:

```nginx
location / {
    proxy_pass http://backend;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

---

## Production Checklist

- [ ] Redis configured with password authentication
- [ ] Environment variables set correctly
- [ ] Rate limits tuned for your traffic patterns
- [ ] CDN configured with proper header forwarding
- [ ] Monitoring and alerting set up
- [ ] Blacklist/whitelist management process documented
- [ ] Load testing completed
- [ ] Backup and recovery plan in place

---

## Next Steps

1. Review full documentation: `docs/RATE_LIMITING_DDOS_PROTECTION.md`
2. Set up monitoring and alerts
3. Configure CDN for production
4. Tune rate limits based on usage patterns
5. Implement automated blacklist management

---

## Support

For detailed documentation, see: `docs/RATE_LIMITING_DDOS_PROTECTION.md`

For issues: security@eduos.com

---

**Last Updated:** 2026-02-07  
**Version:** 1.0
