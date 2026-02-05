# Security Guide

## Overview

This document outlines the security measures implemented in the EduOS Platform and best practices for maintaining a secure deployment.

## Security Features

### 1. Authentication & Authorization

#### JWT Token Security
- **Algorithm**: Supports both HS256 (development) and RS256 (production)
- **Token Expiration**: Access tokens expire in 1 hour, refresh tokens in 7 days
- **Token Validation**: All tokens are validated for signature, expiration, issuer, and audience
- **No Default Secrets**: Application will fail to start if JWT_SECRET is not set

#### Multi-Factor Authentication (MFA)
- **TOTP-based**: Time-based One-Time Password using industry-standard algorithms
- **Encrypted Storage**: MFA secrets are encrypted at rest using AES-256-CBC
- **Backup Codes**: Secure recovery codes with bcrypt hashing
- **Rate Limited**: MFA endpoints are rate-limited to prevent brute force attacks

### 2. Input Validation & Sanitization

All user inputs are validated and sanitized using `express-validator`:

- **UUID Validation**: All IDs must be valid UUID v4 format
- **Email Validation**: Email addresses are validated and normalized
- **Domain Validation**: Custom domain names are validated against RFC standards
- **SQL Injection Prevention**: All database queries use parameterized statements
- **XSS Prevention**: User inputs are escaped and sanitized
- **Search Query Sanitization**: Search queries are limited and sanitized

### 3. Rate Limiting

Multiple rate limiters protect against abuse:

| Endpoint Type | Limit | Window | Purpose |
|--------------|-------|--------|---------|
| General API | 100 requests | 15 minutes | Prevent API abuse |
| Authentication | 5 attempts | 15 minutes | Prevent brute force |
| Password Reset | 3 requests | 1 hour | Prevent enumeration |
| MFA Verification | 10 attempts | 15 minutes | Prevent brute force |
| Domain Verification | 10 requests | 1 hour | Prevent abuse |

### 4. Security Headers

Implemented using Helmet.js:

- **Content Security Policy (CSP)**: Restricts resource loading
- **HSTS**: Forces HTTPS connections
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-XSS-Protection**: Enables browser XSS protection

### 5. CORS Configuration

- **Restricted Origins**: Only whitelisted origins are allowed
- **Credentials Support**: Secure cookie handling
- **Method Restrictions**: Only necessary HTTP methods allowed
- **Header Restrictions**: Only required headers allowed

### 6. Database Security

#### Row-Level Security (RLS)
- **Tenant Isolation**: PostgreSQL RLS ensures data isolation between tenants
- **Automatic Enforcement**: RLS policies are automatically applied to all queries
- **Session Variables**: Tenant context is set via PostgreSQL session variables

#### Query Security
- **Parameterized Queries**: All queries use parameterized statements ($1, $2, etc.)
- **No Dynamic SQL**: No string concatenation in SQL queries
- **Prepared Statements**: Database uses prepared statements for performance and security

### 7. Encryption

#### Data at Rest
- **MFA Secrets**: Encrypted using AES-256-CBC with unique IVs
- **Backup Codes**: Hashed using bcrypt with salt rounds
- **Database**: PostgreSQL supports transparent data encryption (TDE)

#### Data in Transit
- **HTTPS**: All production traffic must use HTTPS
- **TLS 1.2+**: Minimum TLS version enforced
- **Certificate Validation**: SSL certificates are validated

### 8. Session Management

- **Redis-backed**: Sessions stored in Redis for performance and security
- **Session Expiration**: Configurable TTL (default: 1 hour)
- **Concurrent Session Limits**: Maximum 5 concurrent sessions per user
- **Session Invalidation**: Logout invalidates all user sessions

## Security Best Practices

### Production Deployment

1. **Environment Variables**
   ```bash
   # Generate strong secrets
   JWT_SECRET=$(openssl rand -base64 64)
   MFA_ENCRYPTION_KEY=$(openssl rand -base64 32)
   
   # Use RS256 for JWT
   openssl genrsa -out private.pem 2048
   openssl rsa -in private.pem -pubout -out public.pem
   ```

2. **HTTPS Configuration**
   - Use valid SSL/TLS certificates (Let's Encrypt recommended)
   - Enable HSTS with preload
   - Configure secure cookie flags (Secure, HttpOnly, SameSite)

3. **Database Security**
   - Use strong database passwords
   - Restrict database access to application servers only
   - Enable PostgreSQL SSL connections
   - Regular backups with encryption

4. **Rate Limiting**
   - Adjust rate limits based on your traffic patterns
   - Consider using Redis for distributed rate limiting
   - Monitor rate limit violations

5. **Monitoring & Logging**
   - Enable audit logging for sensitive operations
   - Monitor failed authentication attempts
   - Set up alerts for security events
   - Regular security log reviews

### Development Guidelines

1. **Never Commit Secrets**
   - Use `.env` files (excluded from git)
   - Use environment variables for all secrets
   - Rotate secrets regularly

2. **Input Validation**
   - Always validate user input
   - Use the provided validation middleware
   - Sanitize data before storage and display

3. **Error Handling**
   - Don't expose stack traces in production
   - Log errors securely
   - Return generic error messages to users

4. **Dependencies**
   - Regularly update dependencies
   - Run `npm audit` before deployments
   - Review security advisories

## Security Checklist

### Pre-Production

- [ ] All environment variables set with strong values
- [ ] JWT_SECRET is a strong random string (64+ characters)
- [ ] MFA_ENCRYPTION_KEY is at least 32 characters
- [ ] HTTPS enabled with valid certificates
- [ ] CORS configured with specific allowed origins
- [ ] Rate limiting configured appropriately
- [ ] Database passwords are strong and unique
- [ ] PostgreSQL SSL connections enabled
- [ ] Audit logging enabled
- [ ] Error messages don't expose sensitive information
- [ ] All dependencies updated and audited
- [ ] Security headers configured
- [ ] Session management configured securely

### Post-Deployment

- [ ] Monitor authentication failures
- [ ] Review audit logs regularly
- [ ] Monitor rate limit violations
- [ ] Check for security updates weekly
- [ ] Perform security testing
- [ ] Review access logs
- [ ] Test backup and recovery procedures

## Vulnerability Reporting

If you discover a security vulnerability, please email security@eduos.com with:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

**Do not** create public GitHub issues for security vulnerabilities.

## Security Updates

### Recent Security Improvements

#### 2026-02-05
- ✅ Removed hardcoded default secrets
- ✅ Implemented comprehensive rate limiting
- ✅ Added input validation middleware
- ✅ Configured strict CORS policy
- ✅ Enhanced security headers with CSP
- ✅ Added MFA encryption key validation
- ✅ Improved error handling to prevent information disclosure

## Compliance

### Data Protection
- **GDPR**: User data can be exported and deleted
- **Data Minimization**: Only necessary data is collected
- **Encryption**: Sensitive data encrypted at rest and in transit

### Audit Trail
- All sensitive operations are logged
- Audit logs include user, tenant, action, and timestamp
- Logs are immutable and tamper-evident

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)

## Contact

For security questions or concerns:
- Email: security@eduos.com
- Security Team: security-team@eduos.com
