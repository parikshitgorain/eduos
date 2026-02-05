# EduOS Platform - Multi-Factor Authentication (MFA) System

**Version:** 1.0  
**Status:** Complete  
**Last Updated:** 2026-02-05  
**Task:** 1.3.4 - Implement multi-factor authentication (MFA)

---

## Overview

The EduOS Platform implements TOTP-based Multi-Factor Authentication (MFA) to provide an additional layer of security for user accounts. MFA can be configured at both the user and tenant levels, with support for backup codes and recovery flows.

---

## Features

### 1. TOTP-Based Authentication
- **Time-based One-Time Password (TOTP)** using industry-standard algorithms
- Compatible with popular authenticator apps:
  - Google Authenticator
  - Microsoft Authenticator
  - Authy
  - 1Password
  - Any RFC 6238 compliant authenticator

### 2. QR Code Generation
- Automatic QR code generation for easy setup
- Manual entry option with base32 secret
- Branded with EduOS Platform name and user email

### 3. Backup Codes
- 10 single-use backup codes generated on MFA enablement
- Codes are hashed using SHA-256 before storage
- Format: `XXXX-XXXX` (8 hexadecimal characters)
- Can be regenerated at any time with valid TOTP token

### 4. Tenant-Level MFA Enforcement
- Configure MFA requirements per tenant
- Role-based MFA enforcement (e.g., require MFA for admins)
- Grace period for new users (default: 7 days)
- Flexible policy configuration

### 5. Recovery Flow
- Backup code verification for lost devices
- Recovery attempt logging for security monitoring
- Audit trail for all MFA-related actions

---

## Architecture

### Database Schema

#### mfa_settings Table
Stores MFA configuration for each user:

```sql
CREATE TABLE mfa_settings (
  mfa_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(255),  -- Encrypted TOTP secret
  mfa_method VARCHAR(20) DEFAULT 'totp',
  backup_codes_hash TEXT[],  -- Array of hashed backup codes
  backup_codes_used INTEGER DEFAULT 0,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, tenant_id)
);
```

#### mfa_recovery_attempts Table
Tracks recovery attempts for security monitoring:

```sql
CREATE TABLE mfa_recovery_attempts (
  attempt_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  attempt_type VARCHAR(50) NOT NULL,  -- 'backup_code', 'recovery_flow'
  success BOOLEAN DEFAULT FALSE,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
```

#### tenant_mfa_policy Table
Stores tenant-level MFA enforcement policies:

```sql
CREATE TABLE tenant_mfa_policy (
  policy_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  mfa_required BOOLEAN DEFAULT FALSE,
  mfa_required_roles TEXT[],  -- Roles that require MFA
  grace_period_days INTEGER DEFAULT 7,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (tenant_id)
);
```

### Security Features

#### 1. Secret Encryption
- TOTP secrets are encrypted using AES-256-GCM
- Unique initialization vector (IV) for each encryption
- Authentication tag for integrity verification
- Encryption key derived from environment variable

#### 2. Backup Code Hashing
- Backup codes are hashed using SHA-256
- Case-insensitive comparison
- Hyphen-agnostic (codes can be entered with or without hyphens)
- One-time use (codes are removed after successful verification)

#### 3. Time Window
- TOTP verification allows a time window of ±1 step (default 30 seconds)
- Compensates for clock drift between client and server
- Configurable via `MFA_WINDOW` environment variable

---

## API Endpoints

### 1. Setup MFA
**POST** `/api/v1/mfa/setup`

Generate TOTP secret and QR code for MFA setup.

**Request:**
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "tenantId": "uuid"
}
```

**Response:**
```json
{
  "message": "MFA setup initiated. Scan the QR code with your authenticator app.",
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "otpauthUrl": "otpauth://totp/EduOS%20(user@example.com)?secret=JBSWY3DPEHPK3PXP&issuer=EduOS%20Platform"
}
```

### 2. Enable MFA
**POST** `/api/v1/mfa/enable`

Enable MFA after verifying TOTP token.

**Request:**
```json
{
  "userId": "uuid",
  "tenantId": "uuid",
  "token": "123456"
}
```

**Response:**
```json
{
  "message": "MFA enabled successfully. Save these backup codes in a secure location.",
  "backupCodes": [
    "ABCD-1234",
    "EFGH-5678",
    "IJKL-9012",
    "MNOP-3456",
    "QRST-7890",
    "UVWX-1234",
    "YZAB-5678",
    "CDEF-9012",
    "GHIJ-3456",
    "KLMN-7890"
  ]
}
```

### 3. Disable MFA
**POST** `/api/v1/mfa/disable`

Disable MFA for a user.

**Request:**
```json
{
  "userId": "uuid",
  "tenantId": "uuid",
  "token": "123456"  // TOTP token or backup code
}
```

**Response:**
```json
{
  "message": "MFA disabled successfully"
}
```

### 4. Verify TOTP Token
**POST** `/api/v1/mfa/verify`

Verify a TOTP token.

**Request:**
```json
{
  "userId": "uuid",
  "tenantId": "uuid",
  "token": "123456"
}
```

**Response:**
```json
{
  "message": "Token verified successfully",
  "verified": true
}
```

### 5. Verify Backup Code
**POST** `/api/v1/mfa/verify-backup`

Verify a backup code (one-time use).

**Request:**
```json
{
  "userId": "uuid",
  "tenantId": "uuid",
  "code": "ABCD-1234"
}
```

**Response:**
```json
{
  "message": "Backup code verified successfully",
  "verified": true,
  "warning": "This backup code has been used and cannot be used again."
}
```

### 6. Regenerate Backup Codes
**POST** `/api/v1/mfa/regenerate-backup-codes`

Generate new backup codes (invalidates old codes).

**Request:**
```json
{
  "userId": "uuid",
  "tenantId": "uuid",
  "token": "123456"
}
```

**Response:**
```json
{
  "message": "Backup codes regenerated successfully. Save these codes in a secure location.",
  "backupCodes": [
    "NEW1-CODE",
    "NEW2-CODE",
    ...
  ]
}
```

### 7. Get MFA Status
**GET** `/api/v1/mfa/status/:userId/:tenantId`

Get MFA status for a user.

**Response:**
```json
{
  "enabled": true,
  "method": "totp",
  "backupCodesRemaining": 8,
  "backupCodesUsed": 2,
  "lastVerifiedAt": "2026-02-05T10:30:00Z"
}
```

### 8. Check MFA Requirement
**GET** `/api/v1/mfa/required/:userId/:tenantId`

Check if MFA is required for a user based on tenant policy.

**Response:**
```json
{
  "required": true
}
```

### 9. Set Tenant MFA Policy
**POST** `/api/v1/mfa/policy`

Configure tenant-level MFA enforcement.

**Request:**
```json
{
  "tenantId": "uuid",
  "mfaRequired": true,
  "mfaRequiredRoles": ["admin", "teacher"],
  "gracePeriodDays": 14
}
```

**Response:**
```json
{
  "message": "MFA policy updated successfully",
  "policy": {
    "tenant_id": "uuid",
    "mfa_required": true,
    "mfa_required_roles": ["admin", "teacher"],
    "grace_period_days": 14
  }
}
```

### 10. Get Tenant MFA Policy
**GET** `/api/v1/mfa/policy/:tenantId`

Get tenant MFA policy.

**Response:**
```json
{
  "mfaRequired": true,
  "mfaRequiredRoles": ["admin", "teacher"],
  "gracePeriodDays": 14
}
```

---

## User Flows

### Setup Flow

1. **User initiates MFA setup**
   - Call `POST /api/v1/mfa/setup`
   - Receive TOTP secret and QR code

2. **User scans QR code**
   - Open authenticator app
   - Scan QR code or manually enter secret
   - App generates 6-digit codes

3. **User enables MFA**
   - Enter current TOTP token
   - Call `POST /api/v1/mfa/enable`
   - Receive and save backup codes

4. **MFA is now active**
   - User must provide TOTP token on login
   - Backup codes can be used if device is lost

### Login Flow with MFA

1. **User enters credentials**
   - Username/email and password
   - System validates credentials

2. **System checks MFA status**
   - If MFA enabled, prompt for TOTP token
   - If MFA not enabled, complete login

3. **User enters TOTP token**
   - Call `POST /api/v1/mfa/verify`
   - If valid, complete login
   - If invalid, show error and allow retry

4. **Alternative: Use backup code**
   - User can choose "Use backup code"
   - Call `POST /api/v1/mfa/verify-backup`
   - If valid, complete login and warn about remaining codes

### Recovery Flow

1. **User loses MFA device**
   - User cannot generate TOTP tokens
   - User has backup codes saved

2. **User uses backup code**
   - Enter backup code instead of TOTP token
   - Call `POST /api/v1/mfa/verify-backup`
   - Login successful

3. **User sets up new device**
   - Call `POST /api/v1/mfa/setup` to get new QR code
   - Scan with new device
   - Call `POST /api/v1/mfa/regenerate-backup-codes` to get new backup codes

---

## Configuration

### Environment Variables

```bash
# MFA Configuration
MFA_ISSUER=EduOS Platform
MFA_WINDOW=1  # Time window for TOTP verification (±30 seconds per step)
MFA_ENCRYPTION_KEY=change_me_to_a_32_character_key_in_production
```

### Tenant Policy Configuration

Tenants can configure MFA enforcement through the API:

```javascript
// Require MFA for all users
await mfaService.setTenantMFAPolicy(tenantId, {
  mfaRequired: true,
  mfaRequiredRoles: [],
  gracePeriodDays: 7
});

// Require MFA only for admins and teachers
await mfaService.setTenantMFAPolicy(tenantId, {
  mfaRequired: false,
  mfaRequiredRoles: ['admin', 'teacher'],
  gracePeriodDays: 14
});
```

---

## Security Considerations

### 1. Secret Storage
- TOTP secrets are encrypted at rest using AES-256-GCM
- Encryption key should be stored securely (e.g., AWS KMS, HashiCorp Vault)
- Never log or expose secrets in API responses

### 2. Backup Codes
- Backup codes are hashed using SHA-256
- Codes are single-use and removed after verification
- Users should store backup codes securely (password manager, printed copy)

### 3. Rate Limiting
- Implement rate limiting on MFA verification endpoints
- Prevent brute-force attacks on TOTP tokens
- Lock account after multiple failed attempts

### 4. Audit Logging
- All MFA-related actions are logged to `audit_logs` table
- Recovery attempts are tracked in `mfa_recovery_attempts` table
- Monitor for suspicious patterns (multiple failed attempts, unusual locations)

### 5. Time Synchronization
- Ensure server time is synchronized (use NTP)
- TOTP relies on accurate time for token generation
- Time drift can cause verification failures

---

## Testing

### Unit Tests
Run MFA service tests:
```bash
npm test -- src/services/mfaService.test.js
```

### Integration Tests
Run MFA route tests:
```bash
npm test -- src/routes/mfa.test.js
```

### Manual Testing
1. Setup MFA for a test user
2. Verify TOTP token generation
3. Test backup code verification
4. Test MFA disable flow
5. Test tenant policy enforcement

---

## Troubleshooting

### Issue: TOTP tokens not working
**Possible causes:**
- Time drift between client and server
- Incorrect secret entered in authenticator app
- Token expired (tokens are valid for 30 seconds)

**Solutions:**
- Verify server time is synchronized
- Regenerate secret and re-scan QR code
- Increase `MFA_WINDOW` to allow more time drift

### Issue: Backup codes not working
**Possible causes:**
- Code already used
- Incorrect code format
- Case sensitivity issues

**Solutions:**
- Verify code hasn't been used before
- Try entering code without hyphens
- Regenerate backup codes if all are used

### Issue: MFA enforcement not working
**Possible causes:**
- Policy not configured correctly
- Grace period still active
- User roles not matching required roles

**Solutions:**
- Check tenant MFA policy configuration
- Verify user creation date vs grace period
- Confirm user has required roles

---

## Future Enhancements

1. **SMS-based MFA**
   - Send TOTP tokens via SMS
   - Fallback option for users without smartphones

2. **Hardware Security Keys**
   - Support for FIDO2/WebAuthn
   - YubiKey, Google Titan, etc.

3. **Biometric Authentication**
   - Fingerprint, Face ID
   - Platform-specific implementations

4. **Adaptive MFA**
   - Risk-based authentication
   - Require MFA only for suspicious logins

5. **MFA Recovery via Email**
   - Send recovery link to verified email
   - Time-limited recovery tokens

---

## References

- [RFC 6238 - TOTP: Time-Based One-Time Password Algorithm](https://tools.ietf.org/html/rfc6238)
- [RFC 4226 - HOTP: An HMAC-Based One-Time Password Algorithm](https://tools.ietf.org/html/rfc4226)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [NIST SP 800-63B - Digital Identity Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)

---

## Support

For issues or questions about MFA implementation:
- Check the troubleshooting section above
- Review audit logs for error details
- Contact the EduOS Platform team

---

**Document Status:** Complete  
**Last Review:** 2026-02-05  
**Next Review:** 2026-05-05
