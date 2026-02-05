# Domain Verification Workflow

**Task:** 1.2.2 - Implement domain verification workflow  
**Status:** Complete  
**Version:** 1.0  
**Date:** 2026-02-05

---

## Overview

The Domain Verification Workflow provides automated domain verification and SSL certificate provisioning for custom domains. This system ensures that only legitimate domain owners can add custom domains to the EduOS platform.

## Features

✅ **Automatic DNS Verification**: Background job checks DNS TXT records every 15 minutes  
✅ **SSL Certificate Provisioning**: Automatic SSL certificate generation (Let's Encrypt ready)  
✅ **Email Notifications**: Admins receive email when domain is verified  
✅ **SSL Renewal**: Automatic renewal of certificates expiring within 30 days  
✅ **Manual Triggers**: API endpoints for manual verification and SSL provisioning  
✅ **Job Monitoring**: Real-time job status and execution history

---

## Architecture

### Components

1. **Domain Verification Service** (`src/services/domainVerificationService.js`)
   - DNS verification logic
   - SSL certificate provisioning
   - Email notification sending
   - Background job execution

2. **Background Job Scheduler** (`src/jobs/domainVerificationJob.js`)
   - Runs every 15 minutes
   - Verifies pending domains
   - Renews expiring SSL certificates
   - Tracks job execution history

3. **API Endpoints** (`src/routes/domains.js`)
   - Manual SSL provisioning
   - Job status monitoring
   - Manual job triggering

4. **Database Tables**
   - `tenant_domains`: Domain records with verification status
   - `notifications`: Email notification queue

---

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DOMAIN VERIFICATION WORKFLOW                      │
└─────────────────────────────────────────────────────────────────────┘

Step 1: Admin Adds Custom Domain
┌──────────────────────────────────────────────────────────────────┐
│  POST /api/v1/domains                                             │
│  {                                                                │
│    "domain": "school.example.com"                                │
│  }                                                                │
│                                                                   │
│  Response:                                                        │
│  {                                                                │
│    "domain_id": "uuid",                                          │
│    "verification_token": "abc123...",                            │
│    "verification_instructions": {                                │
│      "record_type": "TXT",                                       │
│      "record_name": "_eduos-verification",                       │
│      "record_value": "abc123..."                                 │
│    }                                                              │
│  }                                                                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Step 2: Admin Adds DNS TXT Record
┌──────────────────────────────────────────────────────────────────┐
│  DNS Configuration:                                               │
│  _eduos-verification.school.example.com TXT "abc123..."          │
│                                                                   │
│  Wait for DNS propagation (5-30 minutes)                         │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Step 3: Background Job Verifies DNS (Every 15 Minutes)
┌──────────────────────────────────────────────────────────────────┐
│  Domain Verification Service:                                     │
│  1. Query all unverified domains                                 │
│  2. For each domain:                                             │
│     a. Lookup DNS TXT record                                     │
│     b. Compare with verification_token                           │
│     c. If match:                                                 │
│        - Mark domain as verified                                 │
│        - Send email notification                                 │
│        - Trigger SSL provisioning                                │
│     d. If no match:                                              │
│        - Log failure reason                                      │
│        - Retry on next job run                                   │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Step 4: SSL Certificate Provisioning
┌──────────────────────────────────────────────────────────────────┐
│  SSL Provisioning Service:                                        │
│  1. Verify domain is verified                                    │
│  2. Request SSL certificate (Let's Encrypt)                      │
│  3. Complete ACME challenge                                      │
│  4. Download and install certificate                             │
│  5. Update ssl_status to 'active'                                │
│  6. Set ssl_expires_at (90 days)                                 │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Step 5: Email Notification Sent
┌──────────────────────────────────────────────────────────────────┐
│  Email to: admin@testschool.eduos.com                            │
│  Subject: Domain Verified: school.example.com                    │
│                                                                   │
│  Body:                                                            │
│  "Your custom domain has been successfully verified!             │
│   Domain: school.example.com                                     │
│   Verified At: 2026-02-05T10:30:00Z                              │
│                                                                   │
│   Next Steps:                                                    │
│   1. SSL certificate provisioning in progress                    │
│   2. Update DNS A/CNAME records                                  │
│   3. Test your domain"                                           │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Step 6: SSL Renewal (30 Days Before Expiry)
┌──────────────────────────────────────────────────────────────────┐
│  SSL Renewal Service:                                             │
│  1. Query domains with SSL expiring in 30 days                   │
│  2. For each domain:                                             │
│     a. Request new certificate                                   │
│     b. Complete ACME challenge                                   │
│     c. Download and install certificate                          │
│     d. Update ssl_expires_at                                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## API Reference

### 1. Add Custom Domain

**Endpoint:** `POST /api/v1/domains`

**Request:**
```json
{
  "domain": "school.example.com"
}
```

**Response:**
```json
{
  "tenant_id": "tenant-123",
  "domain": {
    "domain_id": "domain-456",
    "domain": "school.example.com",
    "domain_type": "custom",
    "is_verified": false,
    "verification_token": "abc123def456...",
    "created_at": "2026-02-05T10:00:00Z"
  },
  "verification_instructions": {
    "step1": "Add a TXT record to your DNS configuration",
    "record_type": "TXT",
    "record_name": "_eduos-verification",
    "record_value": "abc123def456...",
    "step2": "Wait for DNS propagation (usually 5-30 minutes)",
    "step3": "Call POST /api/v1/domains/:domainId/verify to verify"
  }
}
```

### 2. Manual Domain Verification

**Endpoint:** `POST /api/v1/domains/:domainId/verify`

**Response (Success):**
```json
{
  "message": "Domain verified successfully",
  "domain": "school.example.com",
  "verified_at": "2026-02-05T10:30:00Z"
}
```

**Response (Failure):**
```json
{
  "error": "Verification Failed",
  "message": "DNS TXT record not found or does not match verification token",
  "expected_record": {
    "name": "_eduos-verification.school.example.com",
    "type": "TXT",
    "value": "abc123def456..."
  },
  "found_records": ["wrong-token"]
}
```

### 3. Manual SSL Provisioning

**Endpoint:** `POST /api/v1/domains/:domainId/provision-ssl`

**Response:**
```json
{
  "message": "SSL certificate provisioned successfully",
  "domain": "school.example.com",
  "ssl_status": "active",
  "issued_at": "2026-02-05T10:35:00Z",
  "expires_at": "2026-05-06T10:35:00Z"
}
```

### 4. Get Job Status

**Endpoint:** `GET /api/v1/domains/jobs/status`

**Response:**
```json
{
  "job_status": {
    "name": "domain-verification-job",
    "enabled": true,
    "running": true,
    "isExecuting": false,
    "intervalMs": 900000,
    "lastRunTime": "2026-02-05T10:30:00Z",
    "lastRunResult": {
      "success": true,
      "duration": 1234,
      "verification": {
        "total": 2,
        "verified": 1,
        "failed": 1,
        "details": [
          {
            "domain": "school1.example.com",
            "status": "verified",
            "verifiedAt": "2026-02-05T10:30:00Z"
          },
          {
            "domain": "school2.example.com",
            "status": "failed",
            "reason": "DNS TXT record not found"
          }
        ]
      },
      "sslRenewal": {
        "total": 1,
        "renewed": 1,
        "failed": 0,
        "details": [
          {
            "domain": "school3.example.com",
            "status": "renewed",
            "expiresAt": "2026-05-06T10:30:00Z"
          }
        ]
      }
    },
    "nextRunTime": "2026-02-05T10:45:00Z"
  },
  "timestamp": "2026-02-05T10:32:00Z"
}
```

### 5. Trigger Job Manually

**Endpoint:** `POST /api/v1/domains/jobs/trigger`

**Response:**
```json
{
  "message": "Background job triggered successfully",
  "result": {
    "success": true,
    "duration": 1234,
    "verification": {
      "total": 1,
      "verified": 1,
      "failed": 0
    },
    "sslRenewal": {
      "total": 0,
      "renewed": 0,
      "failed": 0
    }
  },
  "timestamp": "2026-02-05T10:35:00Z"
}
```

---

## Configuration

### Environment Variables

```bash
# Enable/disable background job (default: true)
DOMAIN_VERIFICATION_JOB_ENABLED=true

# Job interval in milliseconds (default: 900000 = 15 minutes)
DOMAIN_VERIFICATION_JOB_INTERVAL=900000

# Email service configuration
EMAIL_SERVICE_PROVIDER=sendgrid  # or aws-ses, mailgun
EMAIL_API_KEY=your-api-key
EMAIL_FROM_ADDRESS=noreply@eduos.com
EMAIL_FROM_NAME=EduOS Platform

# Let's Encrypt configuration
LETSENCRYPT_EMAIL=admin@eduos.com
LETSENCRYPT_STAGING=false  # Use staging for testing
```

### Job Configuration

The background job can be configured in `src/jobs/domainVerificationJob.js`:

```javascript
const JOB_CONFIG = {
  // Run every 15 minutes
  intervalMs: 15 * 60 * 1000,
  
  // Job name for logging
  name: 'domain-verification-job',
  
  // Enable/disable job
  enabled: process.env.DOMAIN_VERIFICATION_JOB_ENABLED !== 'false'
};
```

---

## DNS Configuration Guide

### Step 1: Add TXT Record

After adding a custom domain, you'll receive a verification token. Add this as a TXT record:

**Record Type:** TXT  
**Record Name:** `_eduos-verification` or `_eduos-verification.school.example.com`  
**Record Value:** `abc123def456...` (your verification token)  
**TTL:** 300 (5 minutes) or default

### Step 2: Verify DNS Propagation

Use online tools or command-line to verify DNS propagation:

```bash
# Using dig (Linux/Mac)
dig TXT _eduos-verification.school.example.com

# Using nslookup (Windows)
nslookup -type=TXT _eduos-verification.school.example.com

# Using online tools
# https://dnschecker.org
# https://mxtoolbox.com/TXTLookup.aspx
```

### Step 3: Wait for Verification

The background job runs every 15 minutes. Your domain will be automatically verified once DNS propagates.

Alternatively, trigger manual verification:
```bash
POST /api/v1/domains/:domainId/verify
```

---

## SSL Certificate Management

### Automatic Provisioning

Once a domain is verified, SSL certificate provisioning begins automatically:

1. **ACME Challenge**: System completes Let's Encrypt ACME challenge
2. **Certificate Download**: Certificate and private key are downloaded
3. **Installation**: Certificate is installed on load balancer/CDN
4. **Database Update**: `ssl_status` set to 'active', expiry date recorded

### Manual Provisioning

Trigger SSL provisioning manually:

```bash
POST /api/v1/domains/:domainId/provision-ssl
```

### Automatic Renewal

Certificates are automatically renewed 30 days before expiry:

- Background job checks for expiring certificates
- Renewal process is identical to initial provisioning
- No downtime during renewal
- Email notification on successful renewal

### SSL Status Values

- `pending`: Certificate not yet provisioned
- `active`: Certificate active and valid
- `failed`: Provisioning failed (check logs)
- `expired`: Certificate has expired (renewal failed)

---

## Email Notifications

### Verification Success Email

**To:** Admin email (from tenant settings)  
**Subject:** Domain Verified: school.example.com

**Body:**
```
Hello Test School Team,

Great news! Your custom domain has been successfully verified:

Domain: school.example.com
Verified At: 2026-02-05T10:30:00Z

Your domain is now active and ready to use. Users can access your EduOS platform at:
https://school.example.com

Next Steps:
1. SSL certificate provisioning is in progress (usually completes within 1 hour)
2. Update your DNS A/CNAME records to point to our servers
3. Test your domain to ensure everything works correctly

If you have any questions, please contact our support team.

Best regards,
EduOS Platform Team
```

### SSL Renewal Email

**To:** Admin email  
**Subject:** SSL Certificate Renewed: school.example.com

**Body:**
```
Hello Test School Team,

Your SSL certificate has been successfully renewed:

Domain: school.example.com
Renewed At: 2026-02-05T10:30:00Z
Expires At: 2026-05-06T10:30:00Z

No action is required on your part. Your domain will continue to work seamlessly.

Best regards,
EduOS Platform Team
```

---

## Monitoring and Logging

### Job Execution Logs

```
[Domain Verification Job] Starting job execution...
[Domain Verification Job] Job completed in 1234ms
[Domain Verification Job] Results: {
  "verification": {
    "total": 2,
    "verified": 1,
    "failed": 1
  },
  "sslRenewal": {
    "total": 1,
    "renewed": 1,
    "failed": 0
  }
}
```

### Performance Metrics

Monitor these metrics:

1. **Job Execution Time**: Should be < 5 seconds for typical workloads
2. **Verification Success Rate**: Should be > 90%
3. **SSL Renewal Success Rate**: Should be > 99%
4. **DNS Lookup Latency**: Should be < 500ms per domain

### Alerting

Set up alerts for:

- Job execution failures (3 consecutive failures)
- SSL renewal failures (certificate expiring in < 7 days)
- High verification failure rate (> 50% failures)
- Job execution time > 30 seconds

---

## Troubleshooting

### Issue: Domain not verifying

**Symptoms:** Domain remains unverified after 30+ minutes

**Solutions:**
1. Check DNS TXT record is correctly configured
2. Verify DNS propagation using `dig` or online tools
3. Check job is running: `GET /api/v1/domains/jobs/status`
4. Trigger manual verification: `POST /api/v1/domains/:domainId/verify`
5. Check logs for DNS lookup errors

### Issue: SSL provisioning failed

**Symptoms:** `ssl_status` is 'failed'

**Solutions:**
1. Verify domain is verified (`is_verified = true`)
2. Check Let's Encrypt rate limits (50 certs per domain per week)
3. Verify ACME challenge can be completed
4. Check logs for specific error messages
5. Trigger manual provisioning: `POST /api/v1/domains/:domainId/provision-ssl`

### Issue: Background job not running

**Symptoms:** `GET /api/v1/domains/jobs/status` shows `running: false`

**Solutions:**
1. Check `DOMAIN_VERIFICATION_JOB_ENABLED` environment variable
2. Restart server to start job
3. Check server logs for job startup errors
4. Verify no uncaught exceptions in job execution

### Issue: Email notifications not sent

**Symptoms:** Domain verified but no email received

**Solutions:**
1. Check email service configuration (API keys, etc.)
2. Verify email address in tenant settings
3. Check spam/junk folder
4. Check `notifications` table for sent status
5. Review email service logs

---

## Testing

### Unit Tests

```bash
# Test domain verification service
npm test -- domainVerificationService.test.js --runInBand

# Test background job
npm test -- domainVerificationJob.test.js --runInBand

# Test API endpoints
npm test -- domains.verification.test.js --runInBand
```

### Integration Testing

```bash
# 1. Start server
npm start

# 2. Add custom domain
curl -X POST http://localhost:3000/api/v1/domains \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant-123" \
  -d '{"domain": "test.example.com"}'

# 3. Add DNS TXT record (use your DNS provider)

# 4. Wait for background job or trigger manually
curl -X POST http://localhost:3000/api/v1/domains/jobs/trigger \
  -H "X-Tenant-ID: tenant-123"

# 5. Check domain status
curl http://localhost:3000/api/v1/domains \
  -H "X-Tenant-ID: tenant-123"
```

### Load Testing

```bash
# Test background job performance with 100 pending domains
# Use Apache Bench or similar tool
ab -n 100 -c 10 http://localhost:3000/api/v1/domains/jobs/trigger
```

---

## Security Considerations

### DNS Verification Security

- Verification tokens are cryptographically random (32 bytes)
- Tokens are unique per domain
- Tokens never expire (can be reused if domain is re-added)
- DNS lookups use system resolver (respects /etc/resolv.conf)

### SSL Certificate Security

- Private keys never leave the server
- Certificates stored securely (encrypted at rest)
- Let's Encrypt rate limits prevent abuse
- ACME challenges use secure protocols

### Email Security

- Email content does not include sensitive data
- Verification tokens not included in emails
- Email delivery failures logged but don't block verification
- Emails sent from verified domain (SPF/DKIM configured)

---

## Future Enhancements

### Planned Features

1. **Webhook Notifications**: Send webhooks on verification success/failure
2. **Multi-Domain SSL**: Support for wildcard certificates
3. **Custom CA Support**: Allow custom Certificate Authorities
4. **DNS Provider Integration**: Automatic DNS record creation
5. **Email Templates**: Customizable email templates per tenant

### Performance Optimizations

1. **Parallel DNS Lookups**: Verify multiple domains concurrently
2. **DNS Caching**: Cache DNS lookup results for 5 minutes
3. **Batch SSL Provisioning**: Provision multiple certificates in parallel
4. **Job Scheduling**: Use cron-like scheduling for flexible intervals

---

## Support

For issues or questions:
- Email: support@eduos.com
- Documentation: https://docs.eduos.com/domain-verification
- GitHub Issues: https://github.com/eduos/platform/issues

---

**Last Updated:** 2026-02-05  
**Version:** 1.0  
**Maintainer:** EduOS Platform Team
