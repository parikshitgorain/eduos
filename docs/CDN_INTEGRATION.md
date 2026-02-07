# CDN Integration Guide

**Task:** 4.4.4 - Setup performance optimization and caching  
**Version:** 1.0  
**Last Updated:** 2026-02-08

---

## Overview

This guide provides instructions for integrating a Content Delivery Network (CDN) to serve static assets and improve global performance. CDN integration reduces latency, improves page load times, and reduces server load.

**Performance Targets:**
- Static asset delivery: < 50ms globally
- Cache hit rate: > 95%
- Bandwidth savings: > 70%

---

## Supported CDN Providers

### 1. Cloudflare (Recommended)

**Advantages:**
- Free tier available
- Global edge network (200+ locations)
- Built-in DDoS protection
- Automatic SSL/TLS
- Web Application Firewall (WAF)

**Setup:**
1. Create Cloudflare account
2. Add domain to Cloudflare
3. Update DNS nameservers
4. Configure caching rules
5. Enable security features

### 2. AWS CloudFront

**Advantages:**
- Deep AWS integration
- Custom SSL certificates
- Lambda@Edge for edge computing
- Real-time metrics

**Setup:**
1. Create CloudFront distribution
2. Configure origin (S3 or custom)
3. Set up SSL certificate (ACM)
4. Configure cache behaviors
5. Update DNS (Route 53 or CNAME)

### 3. Fastly

**Advantages:**
- Real-time purging
- Advanced VCL configuration
- Instant cache invalidation
- Edge computing (Compute@Edge)

---

## Static Assets to Cache

### High Priority (Long TTL: 1 year)
- JavaScript bundles: `/static/js/*.js`
- CSS stylesheets: `/static/css/*.css`
- Fonts: `/static/fonts/*`
- Images: `/static/images/*`
- Icons: `/static/icons/*`

### Medium Priority (Medium TTL: 1 day)
- API documentation: `/docs/*`
- Public pages: `/about`, `/pricing`, `/contact`

### Low Priority (Short TTL: 5 minutes)
- Dynamic content: `/api/*` (cache with revalidation)
- User-specific content: `/dashboard/*` (no cache)

---

## Cloudflare Configuration

### Step 1: Add Domain

```bash
# Login to Cloudflare dashboard
# Add your domain (e.g., eduos.example.com)
# Update nameservers at your domain registrar
```

### Step 2: Page Rules

Create the following page rules in order:

#### Rule 1: Cache Static Assets
```
URL Pattern: *eduos.example.com/static/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 year
  - Browser Cache TTL: 1 year
```

#### Rule 2: Bypass API Endpoints
```
URL Pattern: *eduos.example.com/api/*
Settings:
  - Cache Level: Bypass
```

#### Rule 3: Cache Public Pages
```
URL Pattern: *eduos.example.com/
Settings:
  - Cache Level: Standard
  - Edge Cache TTL: 1 day
  - Browser Cache TTL: 4 hours
```

### Step 3: Security Settings

```yaml
Security Level: Medium
Challenge Passage: 30 minutes
Browser Integrity Check: On
Hotlink Protection: On
```

### Step 4: Performance Settings

```yaml
Auto Minify:
  - JavaScript: On
  - CSS: On
  - HTML: On

Brotli Compression: On
HTTP/2: On
HTTP/3 (QUIC): On
0-RTT Connection Resumption: On
```

### Step 5: Caching Settings

```yaml
Caching Level: Standard
Browser Cache TTL: Respect Existing Headers
Always Online: On
Development Mode: Off (enable during deployments)
```

---

## AWS CloudFront Configuration

### Step 1: Create S3 Bucket for Static Assets

```bash
# Create S3 bucket
aws s3 mb s3://eduos-static-assets --region us-east-1

# Enable static website hosting
aws s3 website s3://eduos-static-assets \
  --index-document index.html \
  --error-document error.html

# Set bucket policy for public read
aws s3api put-bucket-policy \
  --bucket eduos-static-assets \
  --policy file://s3-bucket-policy.json
```

**s3-bucket-policy.json:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::eduos-static-assets/*"
    }
  ]
}
```

### Step 2: Create CloudFront Distribution

```bash
# Create distribution
aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json
```

**cloudfront-config.json:**
```json
{
  "CallerReference": "eduos-cdn-2026",
  "Comment": "EduOS Static Assets CDN",
  "Enabled": true,
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-eduos-static-assets",
        "DomainName": "eduos-static-assets.s3.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-eduos-static-assets",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"]
    },
    "Compress": true,
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000
  },
  "PriceClass": "PriceClass_100",
  "ViewerCertificate": {
    "CloudFrontDefaultCertificate": true
  }
}
```

### Step 3: Configure Cache Behaviors

```json
{
  "CacheBehaviors": {
    "Quantity": 2,
    "Items": [
      {
        "PathPattern": "/static/*",
        "TargetOriginId": "S3-eduos-static-assets",
        "ViewerProtocolPolicy": "redirect-to-https",
        "MinTTL": 31536000,
        "DefaultTTL": 31536000,
        "MaxTTL": 31536000,
        "Compress": true
      },
      {
        "PathPattern": "/api/*",
        "TargetOriginId": "API-Origin",
        "ViewerProtocolPolicy": "https-only",
        "MinTTL": 0,
        "DefaultTTL": 0,
        "MaxTTL": 0,
        "Compress": false
      }
    ]
  }
}
```

---

## Application Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# CDN Configuration
CDN_ENABLED=true
CDN_URL=https://cdn.eduos.example.com
CDN_STATIC_PATH=/static

# Cloudflare (if using)
CLOUDFLARE_ZONE_ID=your_zone_id
CLOUDFLARE_API_TOKEN=your_api_token

# AWS CloudFront (if using)
CLOUDFRONT_DISTRIBUTION_ID=your_distribution_id
AWS_REGION=us-east-1
```

### Express.js Middleware

Create `src/middleware/cdnMiddleware.js`:

```javascript
/**
 * CDN Middleware
 * Rewrites static asset URLs to use CDN
 */

const CDN_URL = process.env.CDN_URL;
const CDN_ENABLED = process.env.CDN_ENABLED === 'true';

function cdnMiddleware(req, res, next) {
  if (CDN_ENABLED) {
    // Add helper function to templates
    res.locals.cdn = (path) => {
      if (path.startsWith('/static/')) {
        return `${CDN_URL}${path}`;
      }
      return path;
    };
  } else {
    res.locals.cdn = (path) => path;
  }
  
  next();
}

module.exports = cdnMiddleware;
```

### Cache-Control Headers

Update `src/server.js`:

```javascript
const express = require('express');
const app = express();

// Serve static files with cache headers
app.use('/static', express.static('public/static', {
  maxAge: '1y', // 1 year for static assets
  immutable: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else if (path.match(/\.(js|css|woff2?|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (path.match(/\.(jpg|jpeg|png|gif|svg|ico)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));
```

---

## Cache Invalidation

### Cloudflare Purge

```javascript
/**
 * Purge Cloudflare cache
 */
const axios = require('axios');

async function purgeCloudflareCache(paths = []) {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  
  const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`;
  
  const payload = paths.length > 0 
    ? { files: paths }
    : { purge_everything: true };
  
  const response = await axios.post(url, payload, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    }
  });
  
  return response.data;
}

// Usage
await purgeCloudflareCache([
  'https://cdn.eduos.example.com/static/js/app.js',
  'https://cdn.eduos.example.com/static/css/main.css',
]);
```

### AWS CloudFront Invalidation

```javascript
/**
 * Invalidate CloudFront cache
 */
const AWS = require('aws-sdk');
const cloudfront = new AWS.CloudFront();

async function invalidateCloudFront(paths = ['/*']) {
  const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;
  
  const params = {
    DistributionId: distributionId,
    InvalidationBatch: {
      CallerReference: `invalidation-${Date.now()}`,
      Paths: {
        Quantity: paths.length,
        Items: paths
      }
    }
  };
  
  const result = await cloudfront.createInvalidation(params).promise();
  return result;
}

// Usage
await invalidateCloudFront([
  '/static/js/*',
  '/static/css/*',
]);
```

---

## Monitoring and Analytics

### Cloudflare Analytics

Access via Cloudflare Dashboard:
- Requests: Total requests served
- Bandwidth: Data transferred
- Cache Hit Rate: Percentage of cached requests
- Threats Blocked: Security events

### CloudFront Metrics (CloudWatch)

```bash
# View CloudFront metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name Requests \
  --dimensions Name=DistributionId,Value=YOUR_DISTRIBUTION_ID \
  --start-time 2026-02-08T00:00:00Z \
  --end-time 2026-02-08T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

### Custom Monitoring

Create `src/utils/cdnMonitoring.js`:

```javascript
/**
 * CDN Performance Monitoring
 */

const { redis } = require('../config/redis');

async function trackCDNMetrics(req, res, next) {
  const cdnHit = req.headers['cf-cache-status'] === 'HIT' || 
                 req.headers['x-cache'] === 'Hit from cloudfront';
  
  const key = `cdn:metrics:${new Date().toISOString().split('T')[0]}`;
  
  if (cdnHit) {
    await redis.hincrby(key, 'hits', 1);
  } else {
    await redis.hincrby(key, 'misses', 1);
  }
  
  await redis.expire(key, 86400 * 7); // Keep for 7 days
  
  next();
}

async function getCDNMetrics(date) {
  const key = `cdn:metrics:${date}`;
  const metrics = await redis.hgetall(key);
  
  const hits = parseInt(metrics.hits || 0);
  const misses = parseInt(metrics.misses || 0);
  const total = hits + misses;
  const hitRate = total > 0 ? (hits / total * 100).toFixed(2) : 0;
  
  return {
    hits,
    misses,
    total,
    hitRate: `${hitRate}%`
  };
}

module.exports = {
  trackCDNMetrics,
  getCDNMetrics
};
```

---

## Best Practices

### 1. Versioned Assets

Use content hashing in filenames:
```
app.js → app.a1b2c3d4.js
main.css → main.e5f6g7h8.css
```

### 2. Separate Domains

Use a separate domain for static assets:
```
Main App: https://app.eduos.com
CDN: https://cdn.eduos.com
```

### 3. Compression

Enable Gzip/Brotli compression:
```javascript
const compression = require('compression');
app.use(compression());
```

### 4. Image Optimization

Use modern formats (WebP, AVIF) with fallbacks:
```html
<picture>
  <source srcset="image.avif" type="image/avif">
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="Description">
</picture>
```

### 5. Lazy Loading

Implement lazy loading for images:
```html
<img src="placeholder.jpg" data-src="actual-image.jpg" loading="lazy">
```

---

## Troubleshooting

### Issue: Low Cache Hit Rate

**Causes:**
- Query strings in URLs
- Cookies being sent
- Vary headers

**Solutions:**
- Remove unnecessary query strings
- Strip cookies for static assets
- Normalize Vary headers

### Issue: Stale Content

**Causes:**
- Long TTL values
- Cache not purged after deployment

**Solutions:**
- Implement cache invalidation in CI/CD
- Use versioned filenames
- Reduce TTL for frequently updated content

### Issue: CORS Errors

**Causes:**
- Missing CORS headers on CDN

**Solutions:**
```javascript
// Add CORS headers
app.use('/static', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD');
  next();
});
```

---

## Performance Validation

### Test CDN Performance

```bash
# Test from multiple locations
curl -I https://cdn.eduos.example.com/static/js/app.js

# Check cache headers
curl -I https://cdn.eduos.example.com/static/css/main.css | grep -i cache

# Measure response time
time curl -o /dev/null -s https://cdn.eduos.example.com/static/images/logo.png
```

### Expected Results

- **Cache-Control:** `public, max-age=31536000, immutable`
- **CF-Cache-Status:** `HIT` (Cloudflare)
- **X-Cache:** `Hit from cloudfront` (AWS)
- **Response Time:** < 50ms globally

---

## Deployment Checklist

- [ ] CDN provider account created
- [ ] Domain configured and verified
- [ ] SSL/TLS certificate installed
- [ ] Cache rules configured
- [ ] Security settings enabled
- [ ] Static assets uploaded
- [ ] Application configured to use CDN URLs
- [ ] Cache invalidation implemented
- [ ] Monitoring and analytics enabled
- [ ] Performance tested from multiple locations
- [ ] Documentation updated

---

## Next Steps

1. Choose CDN provider (Cloudflare recommended for ease of use)
2. Configure DNS and SSL
3. Upload static assets
4. Update application configuration
5. Test thoroughly
6. Monitor performance metrics
7. Optimize based on analytics

---

**Related Documentation:**
- [Performance Optimization Guide](./PERFORMANCE_OPTIMIZATION.md)
- [Caching Strategy](./CACHING_STRATEGY.md)
- [Load Testing Guide](./LOAD_TESTING.md)
