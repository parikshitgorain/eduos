# Login Page Backend Integration Status

**Date:** 2026-02-08  
**Status:** ⚠️ **PARTIALLY COMPLETE** - Missing Critical Endpoints

## Executive Summary

The login page frontend is **NOT fully wired** to the backend. While the frontend is production-ready with 436 passing tests, several critical backend endpoints are **MISSING** that the frontend expects.

## Missing Backend Endpoints

### 🔴 CRITICAL - Authentication Endpoints

#### 1. POST `/api/v1/auth/login` - **MISSING**
**Frontend Expects:**
```typescript
POST /api/v1/auth/login
Body: {
  tenantId: string,
  email: string,
  password: string,
  rememberMe: boolean,
  captchaToken?: string
}

Response: {
  success: boolean,
  requiresMFA: boolean,
  sessionId?: string,  // if MFA required
  token?: string,      // if no MFA
  message?: string
}
```

**Backend Status:** ❌ **NOT IMPLEMENTED**
- The auth routes (`src/routes/auth.js`) only have OAuth2/SSO endpoints
- No email/password login endpoint exists
- No CAPTCHA validation logic

**Impact:** Users cannot log in with email/password

---

#### 2. POST `/api/v1/auth/mfa/verify` - **MISSING**
**Frontend Expects:**
```typescript
POST /api/v1/auth/mfa/verify
Body: {
  sessionId: string,
  otp: string
}

Response: {
  success: boolean,
  token: string,
  message?: string
}
```

**Backend Status:** ❌ **NOT IMPLEMENTED**
- MFA routes exist (`src/routes/mfa.js`) but need verification
- No session-based MFA verification endpoint

**Impact:** Users cannot complete MFA verification

---

#### 3. GET `/api/v1/auth/sso/{provider}` - **PARTIALLY IMPLEMENTED**
**Frontend Expects:**
```typescript
GET /api/v1/auth/sso/{provider}?tenantId={id}&redirectUri={uri}

Response: {
  authorizationUrl: string
}
```

**Backend Has:**
```javascript
GET /auth/{provider}/login?tenant_id={id}

Response: {
  authorization_url: string,
  state: string,
  provider: string
}
```

**Status:** ⚠️ **MISMATCH**
- Different URL path: `/auth/` vs `/api/v1/auth/sso/`
- Different query param: `tenant_id` vs `tenantId`
- Different response field: `authorization_url` vs `authorizationUrl`

**Impact:** SSO initiation will fail due to path/format mismatch

---

#### 4. POST `/api/v1/auth/forgot-password` - **MISSING**
**Frontend Expects:**
```typescript
POST /api/v1/auth/forgot-password
Body: {
  email: string,
  tenantId?: string
}

Response: {
  success: boolean,
  message: string
}
```

**Backend Status:** ❌ **NOT IMPLEMENTED**

**Impact:** Password reset functionality won't work

---

### 🔴 CRITICAL - Tenant Endpoints

#### 5. GET `/api/v1/tenants/search` - **MISSING**
**Frontend Expects:**
```typescript
GET /api/v1/tenants/search?q={query}

Response: {
  tenants: Array<{
    id: string,
    name: string,
    location: string,
    logoUrl?: string,
    contactInfo?: {
      email?: string,
      phone?: string
    }
  }>
}
```

**Backend Has:**
```javascript
GET /api/v1/tenants  // List all with pagination
GET /api/v1/tenants/:tenantId  // Get by ID
GET /api/v1/tenants/subdomain/:subdomain  // Get by subdomain
```

**Status:** ❌ **MISSING SEARCH ENDPOINT**
- No search functionality exists
- Frontend needs to search tenants by name/location
- Current endpoints don't support search queries

**Impact:** Tenant selector dropdown won't work - users can't search for their institution

---

## Existing Backend Endpoints (Working)

### ✅ OAuth2/SSO Endpoints (Partial)
- `GET /auth/{provider}/login` - Initiate OAuth2 (needs path fix)
- `GET /auth/{provider}/callback` - Handle OAuth2 callback
- `POST /auth/token/refresh` - Refresh access token
- `POST /auth/token/verify` - Verify token
- `GET /auth/userinfo` - Get user info (OIDC)
- `POST /auth/logout` - Logout
- `GET /auth/permissions` - Get user permissions

### ✅ Tenant Management
- `POST /api/v1/tenants` - Create tenant
- `GET /api/v1/tenants/:tenantId` - Get tenant by ID
- `GET /api/v1/tenants` - List tenants (paginated)
- `PATCH /api/v1/tenants/:tenantId` - Update tenant
- `GET /api/v1/tenants/subdomain/:subdomain` - Get by subdomain

---

## Required Backend Implementation

### Priority 1: Core Authentication

#### 1. Email/Password Login Endpoint
**File:** `src/routes/auth.js`

```javascript
/**
 * POST /api/v1/auth/login
 * Email/password authentication with optional CAPTCHA
 */
router.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { tenantId, email, password, rememberMe, captchaToken } = req.body;
    
    // Validate required fields
    if (!tenantId || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Verify CAPTCHA if provided (after 3 failed attempts)
    if (captchaToken) {
      // TODO: Verify CAPTCHA token
    }
    
    // Find user
    const userResult = await query(
      `SELECT user_id, tenant_id, email, password_hash, mfa_enabled, status, roles
       FROM users
       WHERE email = $1 AND tenant_id = $2`,
      [email, tenantId]
    );
    
    if (userResult.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    const user = userResult.rows[0];
    
    // Check user status
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active'
      });
    }
    
    // Verify password
    const bcrypt = require('bcrypt');
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordValid) {
      // TODO: Increment failed login counter for CAPTCHA
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Check if MFA is required
    if (user.mfa_enabled) {
      // Generate MFA session
      const sessionId = require('crypto').randomUUID();
      
      // Store session in Redis with 5-minute expiry
      const redis = require('../config/redis');
      await redis.set(
        `mfa_session:${sessionId}`,
        JSON.stringify({ userId: user.user_id, tenantId: user.tenant_id }),
        'EX',
        300
      );
      
      // Send MFA code (TODO: implement)
      
      return res.json({
        success: true,
        requiresMFA: true,
        sessionId: sessionId
      });
    }
    
    // Generate JWT token
    const authService = require('../services/authService');
    const expiresIn = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60; // 30 days or 24 hours
    
    const token = authService.generateAccessToken({
      userId: user.user_id,
      tenantId: user.tenant_id,
      email: user.email,
      roles: user.roles,
      permissions: []
    }, expiresIn);
    
    // Log successful login
    await query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, event_type, event_action, actor_type, actor_id, resource_type, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        user.tenant_id,
        user.user_id,
        'user_login',
        'authentication',
        'login',
        'user',
        user.user_id,
        'authentication',
        JSON.stringify({ method: 'email_password', ip_address: req.ip })
      ]
    );
    
    res.json({
      success: true,
      requiresMFA: false,
      token: token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});
```

#### 2. MFA Verification Endpoint
**File:** `src/routes/auth.js`

```javascript
/**
 * POST /api/v1/auth/mfa/verify
 * Verify MFA code
 */
router.post('/api/v1/auth/mfa/verify', async (req, res) => {
  try {
    const { sessionId, otp } = req.body;
    
    if (!sessionId || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Get session from Redis
    const redis = require('../config/redis');
    const sessionData = await redis.get(`mfa_session:${sessionId}`);
    
    if (!sessionData) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session'
      });
    }
    
    const session = JSON.parse(sessionData);
    
    // Verify OTP (TODO: implement TOTP verification)
    const mfaService = require('../services/mfaService');
    const valid = await mfaService.verifyTOTP(session.userId, otp);
    
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid verification code'
      });
    }
    
    // Delete session
    await redis.del(`mfa_session:${sessionId}`);
    
    // Get user info
    const userResult = await query(
      `SELECT user_id, tenant_id, email, roles FROM users WHERE user_id = $1`,
      [session.userId]
    );
    
    const user = userResult.rows[0];
    
    // Generate JWT token
    const authService = require('../services/authService');
    const token = authService.generateAccessToken({
      userId: user.user_id,
      tenantId: user.tenant_id,
      email: user.email,
      roles: user.roles,
      permissions: []
    });
    
    res.json({
      success: true,
      token: token
    });
    
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});
```

#### 3. Tenant Search Endpoint
**File:** `src/routes/tenants.js`

```javascript
/**
 * GET /api/v1/tenants/search
 * Search tenants by name or location
 * 
 * Query parameters:
 * - q: Search query (minimum 2 characters)
 */
router.get('/search', async (req, res) => {
  const client = await getClient();
  
  try {
    const { q } = req.query;
    
    // Validate query
    if (!q || q.trim().length < 2) {
      return res.json({
        tenants: []
      });
    }
    
    const searchQuery = `%${q.trim()}%`;
    
    // Search by name or location
    const result = await client.query(
      `SELECT tenant_id as id, name, location, logo_url as "logoUrl", contact_info as "contactInfo"
       FROM tenants
       WHERE status = 'active'
         AND (name ILIKE $1 OR location ILIKE $1)
       ORDER BY name
       LIMIT 20`,
      [searchQuery]
    );
    
    res.json({
      tenants: result.rows
    });
    
  } catch (error) {
    console.error('Error searching tenants:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to search tenants'
    });
  } finally {
    client.release();
  }
});
```

#### 4. Forgot Password Endpoint
**File:** `src/routes/auth.js`

```javascript
/**
 * POST /api/v1/auth/forgot-password
 * Request password reset
 */
router.post('/api/v1/auth/forgot-password', async (req, res) => {
  try {
    const { email, tenantId } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Find user (don't reveal if user exists)
    const userResult = await query(
      `SELECT user_id, tenant_id, email, first_name
       FROM users
       WHERE email = $1 ${tenantId ? 'AND tenant_id = $2' : ''}`,
      tenantId ? [email, tenantId] : [email]
    );
    
    if (userResult.rowCount > 0) {
      const user = userResult.rows[0];
      
      // Generate reset token
      const resetToken = require('crypto').randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      // Store reset token
      await query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [user.user_id, resetToken, expiresAt]
      );
      
      // Send email (TODO: implement email service)
      console.log(`Password reset link: /reset-password?token=${resetToken}`);
    }
    
    // Always return success (don't reveal if user exists)
    res.json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.'
    });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});
```

#### 5. Fix SSO Path Mismatch
**File:** `src/routes/auth.js`

```javascript
// Add alias route for frontend compatibility
router.get('/api/v1/auth/sso/:provider', async (req, res) => {
  // Redirect to existing OAuth2 endpoint with parameter mapping
  const { provider } = req.params;
  const { tenantId, redirectUri } = req.query;
  
  // Map to existing endpoint format
  req.query.tenant_id = tenantId;
  
  // Call existing handler
  return router.handle(req, res);
});
```

---

## Database Schema Requirements

### Missing Tables

#### 1. `password_reset_tokens` Table
```sql
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id),
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
```

#### 2. `users` Table Updates
Ensure the users table has:
- `password_hash` column (for email/password login)
- `mfa_enabled` column (boolean)
- `mfa_secret` column (encrypted TOTP secret)
- `failed_login_attempts` column (for CAPTCHA trigger)
- `last_failed_login_at` column

---

## Testing Recommendations

### Backend Integration Tests Needed

1. **Login Flow Test**
   ```javascript
   describe('POST /api/v1/auth/login', () => {
     it('should login with valid credentials', async () => {
       const response = await request(app)
         .post('/api/v1/auth/login')
         .send({
           tenantId: 'test-tenant-id',
           email: 'test@example.com',
           password: 'password123',
           rememberMe: false
         });
       
       expect(response.status).toBe(200);
       expect(response.body.success).toBe(true);
       expect(response.body.token).toBeDefined();
     });
   });
   ```

2. **Tenant Search Test**
   ```javascript
   describe('GET /api/v1/tenants/search', () => {
     it('should return matching tenants', async () => {
       const response = await request(app)
         .get('/api/v1/tenants/search')
         .query({ q: 'University' });
       
       expect(response.status).toBe(200);
       expect(response.body.tenants).toBeInstanceOf(Array);
     });
   });
   ```

---

## Action Items

### Immediate (P0)
- [ ] Implement `POST /api/v1/auth/login` endpoint
- [ ] Implement `GET /api/v1/tenants/search` endpoint
- [ ] Add `password_reset_tokens` table migration
- [ ] Update `users` table with password fields

### High Priority (P1)
- [ ] Implement `POST /api/v1/auth/mfa/verify` endpoint
- [ ] Implement `POST /api/v1/auth/forgot-password` endpoint
- [ ] Fix SSO path mismatch (`/auth/` → `/api/v1/auth/sso/`)
- [ ] Add CAPTCHA verification logic

### Medium Priority (P2)
- [ ] Add backend integration tests
- [ ] Implement email service for password reset
- [ ] Add rate limiting for login attempts
- [ ] Implement TOTP MFA verification

---

## Summary

**Current Status:** ⚠️ **NOT PRODUCTION READY**

**Frontend:** ✅ Complete (436 tests passing)
**Backend:** ❌ Missing 5 critical endpoints

**Estimated Work:** 2-3 days for a developer to implement missing endpoints

**Blocker:** Users cannot log in until backend endpoints are implemented.
