# OAuth2/OIDC Authentication Service

## Overview

The EduOS Platform implements a comprehensive OAuth2/OIDC authentication service that supports:

- OAuth 2.0 Authorization Code Flow with PKCE
- OIDC Discovery endpoints
- JWT token generation with RS256/HS256 signing
- Token expiry: 1 hour (access), 7 days (refresh)
- Integration with Google and Microsoft SSO providers

## Architecture

### Components

1. **AuthService** (`src/services/authService.js`)
   - Core authentication logic
   - JWT token generation and verification
   - OAuth2 client management
   - OIDC discovery document generation

2. **Auth Routes** (`src/routes/auth.js`)
   - OAuth2 login endpoints
   - Token refresh and verification
   - User info endpoint (OIDC standard)
   - Logout functionality

3. **Database Tables**
   - `users`: User accounts with OAuth2/OIDC authentication
   - `audit_logs`: Authentication event audit trail
   - `refresh_tokens`: Refresh token storage
   - `roles`: Role definitions with hierarchical structure
   - `sessions`: Active user sessions

## API Endpoints

### OIDC Discovery

```
GET /.well-known/openid-configuration
```

Returns the OIDC discovery document with all supported endpoints and capabilities.

### JWKS Endpoint

```
GET /.well-known/jwks.json
```

Returns the JSON Web Key Set for token verification.

### OAuth2 Login

```
GET /auth/:provider/login?tenant_id=<tenant-id>
```

Initiates OAuth2 login flow. Supported providers: `google`, `microsoft`.

**Response:**
```json
{
  "authorization_url": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "state": "base64-encoded-state",
  "provider": "google"
}
```

### OAuth2 Callback

```
GET /auth/:provider/callback?code=<code>&state=<state>
```

Handles OAuth2 callback and exchanges authorization code for tokens.

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "user_id": "uuid",
    "tenant_id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "roles": ["user"]
  }
}
```

### Token Refresh

```
POST /auth/token/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Token Verification

```
POST /auth/token/verify
Content-Type: application/json

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "valid": true,
  "payload": {
    "sub": "user-id",
    "tenant_id": "tenant-id",
    "email": "user@example.com",
    "roles": ["user"],
    "permissions": [],
    "type": "access",
    "iat": 1234567890,
    "exp": 1234571490,
    "iss": "eduos-platform",
    "aud": "eduos-api"
  }
}
```

### User Info (OIDC Standard)

```
GET /auth/userinfo
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "name": "John Doe",
  "given_name": "John",
  "family_name": "Doe",
  "tenant_id": "tenant-id",
  "roles": ["user"],
  "created_at": "2026-02-05T10:00:00Z"
}
```

### Logout

```
POST /auth/logout
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

## Configuration

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=eduos-platform
JWT_AUDIENCE=eduos-api

# RS256 Key Pair (Optional - for production)
JWT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----...
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...

# OAuth2 - Google
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# OAuth2 - Microsoft
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_REDIRECT_URI=http://localhost:3000/auth/microsoft/callback

# Base URL
BASE_URL=http://localhost:3000
```

### Generating RS256 Key Pair

For production use, generate an RS256 key pair:

```bash
# Generate private key
openssl genrsa -out private.pem 2048

# Generate public key
openssl rsa -in private.pem -pubout -out public.pem

# Set environment variables
export JWT_PRIVATE_KEY=$(cat private.pem)
export JWT_PUBLIC_KEY=$(cat public.pem)
```

## Security Features

### Token Security

- **RS256 Signing**: Asymmetric signing for production (when private key is configured)
- **HS256 Fallback**: Symmetric signing for development
- **Token Expiration**: Access tokens expire in 1 hour, refresh tokens in 7 days
- **Issuer/Audience Validation**: Tokens include and validate issuer and audience claims

### OAuth2 Security

- **PKCE Support**: Proof Key for Code Exchange (S256 method)
- **State Parameter**: Prevents CSRF attacks with tenant context
- **Code Verifier Storage**: Secure storage of PKCE code verifiers

### Audit Logging

All authentication events are logged to the `audit_logs` table:

- User login
- User logout
- Token refresh
- Failed authentication attempts

## Multi-Tenant Support

The authentication service is fully multi-tenant aware:

- Tenant ID is included in JWT tokens
- OAuth2 state parameter includes tenant context
- Users are scoped to tenants
- Audit logs are tenant-isolated

## Testing

### Unit Tests

```bash
npm test -- --testPathPattern=authService.test.js
```

Tests cover:
- JWT token generation and verification
- Token refresh logic
- State parameter handling
- OIDC discovery documents
- Security features

### Integration Tests

```bash
npm test -- --testPathPattern=auth.test.js
```

Tests cover:
- All API endpoints
- OAuth2 flow
- Token lifecycle
- Error handling
- OIDC compliance

## Usage Example

### Client-Side OAuth2 Flow

```javascript
// 1. Initiate login
const response = await fetch('/auth/google/login?tenant_id=my-tenant-id');
const { authorization_url } = await response.json();

// 2. Redirect user to authorization URL
window.location.href = authorization_url;

// 3. Handle callback (on your callback page)
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const state = urlParams.get('state');

const callbackResponse = await fetch(`/auth/google/callback?code=${code}&state=${state}`);
const { access_token, refresh_token } = await callbackResponse.json();

// 4. Store tokens
localStorage.setItem('access_token', access_token);
localStorage.setItem('refresh_token', refresh_token);

// 5. Use access token for API requests
const apiResponse = await fetch('/api/students', {
  headers: {
    'Authorization': `Bearer ${access_token}`
  }
});
```

### Token Refresh

```javascript
async function refreshToken() {
  const refresh_token = localStorage.getItem('refresh_token');
  
  const response = await fetch('/auth/token/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refresh_token })
  });
  
  const { access_token, refresh_token: new_refresh_token } = await response.json();
  
  localStorage.setItem('access_token', access_token);
  localStorage.setItem('refresh_token', new_refresh_token);
}
```

## Next Steps

1. **Task 1.3.2**: Implement hierarchical RBAC
2. **Task 1.3.3**: Build session management with Redis
3. **Task 1.3.4**: Implement multi-factor authentication (MFA)

## References

- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)
- [JWT RFC 7519](https://tools.ietf.org/html/rfc7519)
