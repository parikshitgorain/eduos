# Security Protection Guide

**Task:** 4.3.2 - Setup SQL injection and XSS protection  
**Status:** Implemented  
**Last Updated:** 2026-02-07

---

## Overview

The EduOS Platform implements comprehensive security protections against SQL injection and Cross-Site Scripting (XSS) attacks. This document describes the security measures in place and how to use them effectively.

---

## Table of Contents

1. [SQL Injection Protection](#sql-injection-protection)
2. [XSS Protection](#xss-protection)
3. [Content Security Policy](#content-security-policy)
4. [Secure Query Helpers](#secure-query-helpers)
5. [Security Headers](#security-headers)
6. [Best Practices](#best-practices)
7. [Testing](#testing)

---

## SQL Injection Protection

### Overview

SQL injection is prevented through multiple layers of defense:

1. **Parameterized Queries**: All database queries use parameterized statements (`$1`, `$2`, etc.)
2. **Input Validation**: Automatic detection and blocking of SQL injection patterns
3. **Query Validation**: Development-time validation of query structure

### Automatic Protection

The `sqlInjectionProtection` middleware automatically scans all incoming requests for SQL injection patterns:

```javascript
// Automatically applied to all routes
app.use(securityMiddleware);
```

### Blocked Patterns

The following SQL injection patterns are automatically detected and blocked:

- SQL keywords: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE`, `ALTER`, `UNION`
- SQL comments: `--`, `#`, `/*`, `*/`
- Boolean attacks: `OR 1=1`, `AND 1=1`
- Command separators: `;`, `|`, `&&`
- Time-based injection: `SLEEP`, `BENCHMARK`, `WAITFOR DELAY`
- File operations: `LOAD_FILE`, `INTO OUTFILE`

### Example: Safe Query

```javascript
// ✅ SAFE: Using parameterized query
const result = await client.query(
  'SELECT * FROM users WHERE id = $1 AND status = $2',
  [userId, 'active']
);
```

### Example: Unsafe Query (Blocked)

```javascript
// ❌ UNSAFE: String concatenation (will be blocked)
const result = await client.query(
  `SELECT * FROM users WHERE id = '${userId}'`
);
```

---

## XSS Protection

### Overview

Cross-Site Scripting (XSS) attacks are prevented through:

1. **Input Sanitization**: Automatic escaping of HTML/JavaScript in user input
2. **Output Encoding**: Proper encoding of all JSON responses
3. **Content Security Policy**: Strict CSP headers to prevent script injection

### Automatic Sanitization

The `xssProtection` middleware automatically sanitizes all incoming requests:

```javascript
// Automatically applied to all routes
app.use(securityMiddleware);
```

### Blocked Patterns

The following XSS patterns are automatically detected and sanitized:

- Script tags: `<script>`, `</script>`
- Event handlers: `onclick`, `onerror`, `onload`, etc.
- JavaScript protocol: `javascript:`
- Dangerous tags: `<iframe>`, `<object>`, `<embed>`, `<applet>`
- Style tags: `<style>`, `<link>`
- Data URIs: `data:text/html`

### Example: Input Sanitization

```javascript
// Input
req.body = {
  comment: '<script>alert("XSS")</script>'
};

// After xssProtection middleware
req.body = {
  comment: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
};
```

---

## Content Security Policy

### CSP Headers

The platform uses Helmet to configure strict Content Security Policy headers:

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### What This Means

- **defaultSrc: ["'self'"]**: Only load resources from the same origin
- **scriptSrc: ["'self'"]**: Only execute scripts from the same origin
- **objectSrc: ["'none'"]**: Block all plugins (Flash, Java, etc.)
- **frameSrc: ["'none'"]**: Prevent embedding in iframes
- **HSTS**: Force HTTPS for 1 year, including subdomains

---

## Secure Query Helpers

### Overview

The `secureQuery` module provides utilities for building safe database queries:

```javascript
const {
  secureQuery,
  secureTransaction,
  validateIdentifier,
  buildWhereClause,
  buildOrderByClause,
  buildLimitOffsetClause
} = require('./utils/secureQuery');
```

### secureQuery

Executes a parameterized query with validation:

```javascript
const result = await secureQuery(
  client,
  'SELECT * FROM users WHERE id = $1',
  [userId]
);
```

**Features:**
- Validates parameter count matches placeholders
- Logs errors without exposing sensitive details
- Development-time validation of query structure

### secureTransaction

Executes a transaction with automatic rollback on error:

```javascript
const result = await secureTransaction(pool, async (client) => {
  await secureQuery(client, 'INSERT INTO users ...', [params]);
  await secureQuery(client, 'INSERT INTO profiles ...', [params]);
  return { success: true };
});
```

### validateIdentifier

Validates SQL identifiers (table names, column names) to prevent injection:

```javascript
validateIdentifier('users'); // ✅ Valid
validateIdentifier('user_id'); // ✅ Valid
validateIdentifier('users.id'); // ✅ Valid
validateIdentifier('users; DROP TABLE'); // ❌ Throws error
```

### buildWhereClause

Builds safe WHERE clauses with parameterized conditions:

```javascript
const conditions = {
  tenant_id: '123',
  status: ['active', 'pending'],
  deleted_at: null
};

const { whereClause, params } = buildWhereClause(conditions);
// WHERE tenant_id = $1 AND status IN ($2, $3) AND deleted_at IS NULL
// params: ['123', 'active', 'pending']
```

### buildOrderByClause

Builds safe ORDER BY clauses:

```javascript
const orderBy = buildOrderByClause('created_at', 'DESC');
// ORDER BY created_at DESC
```

### buildLimitOffsetClause

Builds safe LIMIT and OFFSET clauses:

```javascript
const { clause, params } = buildLimitOffsetClause(10, 20);
// LIMIT $1 OFFSET $2
// params: [10, 20]
```

---

## Security Headers

### Additional Headers

The platform sets the following security headers on all responses:

```javascript
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### What These Headers Do

- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-XSS-Protection**: Enables browser XSS filter
- **Referrer-Policy**: Controls referrer information
- **Permissions-Policy**: Restricts browser features

---

## Best Practices

### 1. Always Use Parameterized Queries

```javascript
// ✅ GOOD
const result = await client.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// ❌ BAD
const result = await client.query(
  `SELECT * FROM users WHERE email = '${email}'`
);
```

### 2. Validate User Input

```javascript
const { body, validationResult } = require('express-validator');

router.post('/users',
  body('email').isEmail().normalizeEmail(),
  body('name').trim().escape(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // Process request
  }
);
```

### 3. Use Secure Query Helpers

```javascript
const { buildWhereClause, secureQuery } = require('./utils/secureQuery');

const conditions = { tenant_id: tenantId, status: 'active' };
const { whereClause, params } = buildWhereClause(conditions);

const result = await secureQuery(
  client,
  `SELECT * FROM users ${whereClause}`,
  params
);
```

### 4. Sanitize Output

```javascript
// The outputEncoding middleware automatically sets security headers
// on all JSON responses, but for HTML responses:

const sanitizeHtml = require('sanitize-html');

const cleanHtml = sanitizeHtml(userInput, {
  allowedTags: ['b', 'i', 'em', 'strong', 'a'],
  allowedAttributes: {
    'a': ['href']
  }
});
```

### 5. Validate Dynamic Identifiers

```javascript
const { validateIdentifier } = require('./utils/secureQuery');

// When using dynamic table or column names
const tableName = req.query.table;
validateIdentifier(tableName); // Throws if invalid

const query = `SELECT * FROM ${tableName} WHERE id = $1`;
```

---

## Testing

### Running Security Tests

```bash
# Run all tests
npm test

# Run security-specific tests
npm test -- securityProtection.test.js
npm test -- secureQuery.test.js
```

### Test Coverage

The security implementation includes comprehensive tests for:

- SQL injection detection (15+ test cases)
- XSS sanitization (10+ test cases)
- Parameterized query validation
- Secure query helpers
- Security headers
- Integration scenarios

### Example Test

```javascript
it('should block SQL injection in body', () => {
  req.body = {
    name: "John'; DROP TABLE users; --"
  };

  sqlInjectionProtection(req, res, next);

  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(400);
});
```

---

## Security Audit

### Automated Scanning

The platform can be scanned with OWASP ZAP for security vulnerabilities:

```bash
# Install OWASP ZAP
# https://www.zaproxy.org/download/

# Run baseline scan
zap-baseline.py -t http://localhost:3000 -r security-report.html
```

### Manual Testing

Test SQL injection protection:

```bash
# Should be blocked
curl -X POST http://localhost:3000/api/students \
  -H "Content-Type: application/json" \
  -d '{"name": "John'\'' OR 1=1 --"}'
```

Test XSS protection:

```bash
# Should be sanitized
curl -X POST http://localhost:3000/api/students \
  -H "Content-Type: application/json" \
  -d '{"comment": "<script>alert(1)</script>"}'
```

---

## Monitoring

### Security Logs

All security events are logged with the following format:

```javascript
console.warn('[SECURITY] Potential SQL injection detected:', {
  ip: req.ip,
  path: req.path,
  method: req.method,
  field: 'body.name',
  pattern: '/SELECT/gi',
  timestamp: '2026-02-07T10:30:00.000Z'
});
```

### Alerting

In production, configure alerts for:

- Multiple security violations from the same IP
- Unusual patterns of blocked requests
- Failed authentication attempts
- Suspicious query patterns

---

## Compliance

This implementation helps meet the following compliance requirements:

- **OWASP Top 10**: Protection against A03:2021 (Injection) and A07:2021 (XSS)
- **PCI DSS**: Requirement 6.5.1 (Injection flaws) and 6.5.7 (XSS)
- **GDPR**: Article 32 (Security of processing)
- **ISO 27001**: A.14.2.5 (Secure system engineering principles)

---

## References

- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Content Security Policy Reference](https://content-security-policy.com/)
- [Helmet.js Documentation](https://helmetjs.github.io/)

---

## Support

For security concerns or questions:

- Email: security@eduos.platform
- Security Advisory: See SECURITY.md
- Bug Bounty: See SECURITY.md

---

**Last Updated:** 2026-02-07  
**Version:** 1.0  
**Status:** Production Ready
