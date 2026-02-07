# Encryption Quick Start Guide

**Task:** 4.3.3 - Implement encryption at rest and in transit  
**Time to Complete:** 15 minutes

---

## Prerequisites

- Node.js 16+ installed
- PostgreSQL 14+ running
- OpenSSL installed (for certificate generation)

---

## Step 1: Run Database Migration (2 minutes)

```bash
# Run encryption migration
node database/run_migration_021.js
```

**Expected Output:**
```
✅ Migration 021 completed successfully!

Created tables:
  ✓ encryption_keys
  ✓ encryption_audit_log

Added encrypted columns:
  ✓ students.national_id_encrypted (text)
  ✓ students.medical_history_encrypted (text)
  ✓ payments.payment_info_encrypted (text)
```

---

## Step 2: Configure Encryption Keys (3 minutes)

### Option A: Environment Variable (Development)

```bash
# Generate a secure key
openssl rand -base64 32

# Add to .env
echo "MASTER_ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
echo "KMS_PROVIDER=env" >> .env
```

### Option B: AWS KMS (Production)

```bash
# Add to .env
cat >> .env << EOF
KMS_PROVIDER=aws
AWS_KMS_KEY_ID=arn:aws:kms:us-east-1:123456789012:key/your-key-id
AWS_REGION=us-east-1
EOF
```

### Option C: HashiCorp Vault (Production)

```bash
# Add to .env
cat >> .env << EOF
KMS_PROVIDER=vault
VAULT_ADDR=https://vault.example.com:8200
VAULT_TOKEN=s.xxxxxxxxxxxxxxxx
VAULT_KEY_PATH=secret/data/eduos/encryption-key
EOF
```

---

## Step 3: Enable TLS 1.3 (5 minutes)

### Development (Self-Signed Certificate)

```bash
# Create certs directory
mkdir -p certs

# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 \
  -keyout certs/server.key \
  -out certs/server.crt \
  -days 365 -nodes \
  -subj "/CN=localhost"

# Enable TLS in .env
cat >> .env << EOF
TLS_ENABLED=true
TLS_CERT_PATH=./certs/server.crt
TLS_KEY_PATH=./certs/server.key
HTTPS_PORT=3443
EOF
```

### Production (Let's Encrypt)

```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com

# Configure .env
cat >> .env << EOF
TLS_ENABLED=true
TLS_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
HTTPS_PORT=443
EOF
```

---

## Step 4: Initialize Encryption Service (2 minutes)

```javascript
// In your application startup (e.g., src/server.js)
const { getEncryptionService } = require('./services/encryptionService');
const { pool } = require('./config/database');

// Initialize encryption service
const encryptionService = getEncryptionService(pool);
await encryptionService.initialize();

console.log('✅ Encryption service initialized');
```

---

## Step 5: Test Encryption (3 minutes)

### Test Script

Create `test-encryption.js`:

```javascript
const { getEncryptionService } = require('./src/services/encryptionService');
const { Pool } = require('pg');
require('dotenv').config();

async function testEncryption() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  const encryptionService = getEncryptionService(pool);
  await encryptionService.initialize();

  // Test national ID encryption
  const nationalId = '1234-5678-9012';
  console.log('Original National ID:', nationalId);

  const encrypted = encryptionService.encryptNationalId(nationalId);
  console.log('Encrypted:', encrypted);

  const decrypted = encryptionService.decryptNationalId(encrypted);
  console.log('Decrypted:', decrypted);

  console.log('✅ Encryption test passed!');

  await pool.end();
}

testEncryption().catch(console.error);
```

Run the test:

```bash
node test-encryption.js
```

**Expected Output:**
```
Original National ID: 1234-5678-9012
Encrypted: v1:a1b2c3d4e5f6....:1a2b3c4d5e6f....:9f8e7d6c5b4a....
Decrypted: 1234-5678-9012
✅ Encryption test passed!
```

---

## Step 6: Verify TLS Configuration (2 minutes)

```bash
# Start server
npm start

# Test HTTPS connection (in another terminal)
curl -k https://localhost:3443/health

# Check TLS version
openssl s_client -connect localhost:3443 -tls1_3
```

**Expected Output:**
```
Protocol  : TLSv1.3
Cipher    : TLS_AES_256_GCM_SHA384
```

---

## Usage Examples

### Encrypt Student Data

```javascript
const { getEncryptionService } = require('./services/encryptionService');
const { pool } = require('./config/database');

const encryptionService = getEncryptionService(pool);

// Encrypt national ID
const nationalId = '1234-5678-9012';
const encrypted = encryptionService.encryptNationalId(nationalId);

// Store in database
await client.query(`
  UPDATE students
  SET national_id_encrypted = $1
  WHERE student_id = $2
`, [encrypted, studentId]);
```

### Decrypt Student Data

```javascript
// Retrieve from database
const result = await client.query(`
  SELECT national_id_encrypted
  FROM students
  WHERE student_id = $1
`, [studentId]);

// Decrypt
const encrypted = result.rows[0].national_id_encrypted;
const nationalId = encryptionService.decryptNationalId(encrypted);
```

---

## Verification Checklist

- [ ] Database migration completed successfully
- [ ] Encryption key configured in .env
- [ ] TLS certificates generated
- [ ] TLS enabled in .env
- [ ] Encryption service initialized
- [ ] Test encryption passed
- [ ] HTTPS endpoint accessible
- [ ] TLS 1.3 verified

---

## Monitoring

### Check Key Rotation Status

```sql
SELECT * FROM encryption_key_status;
```

### View Encryption Audit Log

```sql
SELECT 
  operation,
  field_type,
  COUNT(*) as count
FROM encryption_audit_log
WHERE performed_at > NOW() - INTERVAL '24 hours'
GROUP BY operation, field_type;
```

---

## Troubleshooting

### Issue: Master key not set

**Error:** `MASTER_ENCRYPTION_KEY environment variable is required`

**Solution:**
```bash
echo "MASTER_ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
```

### Issue: TLS certificate not found

**Error:** `TLS certificate not found at ./certs/server.crt`

**Solution:**
```bash
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt -days 365 -nodes -subj "/CN=localhost"
```

### Issue: Decryption fails

**Error:** `Unsupported tag length or additional data corrupted`

**Solution:**
- Verify MASTER_ENCRYPTION_KEY hasn't changed
- Check if data was encrypted with a different key
- Ensure field type matches during encryption/decryption

---

## Next Steps

1. **Encrypt Existing Data:** Run migration script to encrypt existing sensitive data
2. **Configure Key Rotation:** Set up automated key rotation (every 90 days)
3. **Enable Monitoring:** Set up alerts for encryption failures
4. **Production Deployment:** Switch to AWS KMS or HashiCorp Vault
5. **Certificate Renewal:** Set up automated certificate renewal (Let's Encrypt)

---

## Security Reminders

- ✅ Never commit encryption keys to version control
- ✅ Use KMS in production (AWS KMS or HashiCorp Vault)
- ✅ Rotate keys every 90 days
- ✅ Monitor encryption audit logs
- ✅ Use TLS 1.3 only (disable older versions)
- ✅ Keep certificates up to date

---

## Support

For issues or questions:
- Documentation: `docs/ENCRYPTION_AT_REST.md`
- Logs: `tail -f logs/encryption.log`
- Audit: `SELECT * FROM encryption_audit_log ORDER BY performed_at DESC LIMIT 100`
