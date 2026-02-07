# Security Quick Start Guide

**Quick reference for developers on SQL injection and XSS protection**

---

## ✅ Do's

### Always Use Parameterized Queries

```javascript
// ✅ GOOD
const result = await client.query(
  'SELECT * FROM users WHERE id = $1 AND status = $2',
  [userId, 'active']
);
```

### Use Secure Query Helpers

```javascript
const { buildWhereClause, secureQuery } = require('./utils/secureQuery');

// ✅ GOOD
const conditions = { tenant_id: tenantId, status: 'active' };
const { whereClause, params } = buildWhereClause(conditions);
const result = await secureQuery(client, `SELECT * FROM users ${whereClause}`, params);
```

### Validate User Input

```javascript
const { body } = require('express-validator');

// ✅ GOOD
router.post('/users',
  body('email').isEmail().normalizeEmail(),
  body('name').trim().escape(),
  async (req, res) => {
    // Process request
  }
);
```

---

## ❌ Don'ts

### Never Use String Concatenation

```javascript
// ❌ BAD - SQL Injection vulnerability
const result = await client.query(
  `SELECT * FROM users WHERE id = '${userId}'`
);

// ❌ BAD - SQL Injection vulnerability
const result = await client.query(
  'SELECT * FROM users WHERE id = ' + userId
);
```

### Never Use Template Literals for Queries

```javascript
// ❌ BAD - SQL Injection vulnerability
const result = await client.query(
  `SELECT * FROM users WHERE id = ${userId}`
);
```

### Never Trust User Input

```javascript
// ❌ BAD - XSS vulnerability
res.send(`<h1>Welcome ${req.body.name}</h1>`);

// ✅ GOOD - Use JSON responses
res.json({ message: `Welcome ${req.body.name}` });
```

---

## Automatic Protection

The security middleware automatically protects against:

### SQL Injection
- Blocks SQL keywords in user input
- Detects SQL comments and operators
- Prevents boolean attacks (OR 1=1)
- Stops time-based injection

### XSS
- Escapes HTML entities
- Removes script tags
- Sanitizes event handlers
- Blocks javascript: protocol

---

## Security Headers

All responses automatically include:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

---

## Testing Security

### Test SQL Injection Protection

```bash
# Should be blocked
curl -X POST http://localhost:3000/api/students \
  -H "Content-Type: application/json" \
  -d '{"name": "John'\'' OR 1=1 --"}'
```

### Test XSS Protection

```bash
# Should be sanitized
curl -X POST http://localhost:3000/api/students \
  -H "Content-Type: application/json" \
  -d '{"comment": "<script>alert(1)</script>"}'
```

---

## Common Patterns

### Safe Query Building

```javascript
// Build WHERE clause
const { whereClause, params } = buildWhereClause({
  tenant_id: tenantId,
  status: ['active', 'pending']
});

// Build ORDER BY
const orderBy = buildOrderByClause('created_at', 'DESC');

// Build LIMIT/OFFSET
const { clause: limitClause, params: limitParams } = buildLimitOffsetClause(10, 20);

// Combine
const query = `
  SELECT * FROM users 
  ${whereClause} 
  ${orderBy} 
  ${limitClause}
`;
const allParams = [...params, ...limitParams];
```

### Safe Transaction

```javascript
const { secureTransaction } = require('./utils/secureQuery');

const result = await secureTransaction(pool, async (client) => {
  await secureQuery(client, 'INSERT INTO users ...', [params]);
  await secureQuery(client, 'INSERT INTO profiles ...', [params]);
  return { success: true };
});
```

---

## Need Help?

- 📖 Full Documentation: `docs/SECURITY_PROTECTION.md`
- 🔍 Code Examples: `src/middleware/securityProtection.test.js`
- 🛠️ Query Helpers: `src/utils/secureQuery.js`

---

**Remember:** Security is everyone's responsibility! 🔒
