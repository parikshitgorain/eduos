# MFA Quick Start Guide

**For Developers** - Quick reference for implementing MFA in the EduOS Platform

---

## Setup MFA for a User

```javascript
const mfaService = require('./services/mfaService');

// 1. Generate TOTP secret and QR code
const setup = await mfaService.generateTOTPSecret(
  userId,
  'user@example.com',
  tenantId
);

// Display QR code to user
console.log('Scan this QR code:', setup.qrCode);
console.log('Or enter this secret manually:', setup.secret);

// 2. User scans QR code with authenticator app

// 3. User enters TOTP token to enable MFA
const result = await mfaService.enableMFA(userId, tenantId, '123456');

// Display backup codes to user (IMPORTANT: User must save these!)
console.log('Backup codes:', result.backupCodes);
```

---

## Verify TOTP Token (Login)

```javascript
// Check if user has MFA enabled
const status = await mfaService.getMFAStatus(userId, tenantId);

if (status.enabled) {
  // Prompt user for TOTP token
  const token = getUserInput(); // Get from request
  
  // Verify token
  const verified = await mfaService.verifyTOTP(userId, tenantId, token);
  
  if (verified) {
    // Allow login
    console.log('MFA verification successful');
  } else {
    // Reject login
    console.log('Invalid MFA token');
  }
}
```

---

## Verify Backup Code (Recovery)

```javascript
// User lost their device, using backup code
const code = getUserInput(); // e.g., "ABCD-1234"

const verified = await mfaService.verifyBackupCode(userId, tenantId, code);

if (verified) {
  console.log('Backup code verified. Login successful.');
  console.log('Warning: This code cannot be used again.');
  
  // Suggest user to set up new device
  console.log('Please set up MFA on your new device.');
} else {
  console.log('Invalid backup code');
}
```

---

## Disable MFA

```javascript
// User must provide TOTP token or backup code to disable
const token = getUserInput();

await mfaService.disableMFA(userId, tenantId, token);

console.log('MFA disabled successfully');
```

---

## Regenerate Backup Codes

```javascript
// User must provide current TOTP token
const token = getUserInput();

const result = await mfaService.regenerateBackupCodes(userId, tenantId, token);

console.log('New backup codes:', result.backupCodes);
console.log('Old backup codes are now invalid');
```

---

## Configure Tenant MFA Policy

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

// Check if MFA is required for a user
const requirement = await mfaService.isMFARequired(userId, tenantId);
if (requirement.required) {
  console.log('MFA is required for this user');
}
```

---

## API Endpoints

### Setup MFA
```bash
POST /api/v1/mfa/setup
Content-Type: application/json

{
  "userId": "uuid",
  "email": "user@example.com",
  "tenantId": "uuid"
}
```

### Enable MFA
```bash
POST /api/v1/mfa/enable
Content-Type: application/json

{
  "userId": "uuid",
  "tenantId": "uuid",
  "token": "123456"
}
```

### Verify TOTP
```bash
POST /api/v1/mfa/verify
Content-Type: application/json

{
  "userId": "uuid",
  "tenantId": "uuid",
  "token": "123456"
}
```

### Verify Backup Code
```bash
POST /api/v1/mfa/verify-backup
Content-Type: application/json

{
  "userId": "uuid",
  "tenantId": "uuid",
  "code": "ABCD-1234"
}
```

### Get MFA Status
```bash
GET /api/v1/mfa/status/:userId/:tenantId
```

---

## Environment Variables

```bash
# .env file
MFA_ISSUER=EduOS Platform
MFA_WINDOW=1
MFA_ENCRYPTION_KEY=your-32-character-encryption-key-here
```

---

## Testing

```bash
# Run MFA tests
npm test -- --testPathPattern="mfa" --runInBand

# Run specific test file
npm test -- src/services/mfaService.test.js
npm test -- src/routes/mfa.test.js
```

---

## Common Issues

### Issue: "Invalid TOTP token"
- Check server time is synchronized (use NTP)
- Verify user scanned correct QR code
- Token expires after 30 seconds

### Issue: "Backup code not working"
- Code may have been used already
- Try entering without hyphens
- Codes are case-insensitive

### Issue: "MFA not required but should be"
- Check tenant MFA policy
- Verify user roles match required roles
- Check grace period hasn't expired

---

## Security Best Practices

1. **Never log secrets or tokens**
   ```javascript
   // BAD
   console.log('Secret:', secret);
   
   // GOOD
   console.log('Secret generated successfully');
   ```

2. **Always use HTTPS in production**
   - QR codes and secrets should never be transmitted over HTTP

3. **Rate limit MFA endpoints**
   - Prevent brute-force attacks on TOTP tokens

4. **Store backup codes securely**
   - Encourage users to use password managers
   - Provide printable backup code sheet

5. **Monitor failed attempts**
   - Alert on multiple failed MFA attempts
   - Consider account lockout after threshold

---

## Full Documentation

For complete documentation, see:
- **docs/MFA_SYSTEM.md** - Comprehensive MFA documentation
- **docs/tasks/TASK_1.3.4_IMPLEMENTATION_SUMMARY.md** - Implementation details

---

**Need Help?** Contact the EduOS Platform team or check the troubleshooting section in MFA_SYSTEM.md
