/**
 * EduOS Platform - Multi-Factor Authentication Service
 * 
 * TOTP-based MFA with backup codes and recovery flows
 * Task: 1.3.4 - Implement multi-factor authentication (MFA)
 */

const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { Pool } = require('pg');

class MFAService {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'eduos',
      user: process.env.DB_USER || 'eduos_app',
      password: process.env.DB_PASSWORD,
    });
  }

  /**
   * Generate TOTP secret for a user
   * @param {string} userId - User ID
   * @param {string} email - User email
   * @param {string} tenantId - Tenant ID
   * @returns {Object} Secret and QR code data URL
   */
  async generateTOTPSecret(userId, email, tenantId) {
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `EduOS (${email})`,
      issuer: 'EduOS Platform',
      length: 32,
    });

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Store secret in database (encrypted)
    const encryptedSecret = this.encryptSecret(secret.base32);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Set tenant context for RLS
      await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);

      // Insert or update MFA settings
      await client.query(
        `INSERT INTO mfa_settings (tenant_id, user_id, mfa_secret, mfa_enabled)
         VALUES ($1, $2, $3, FALSE)
         ON CONFLICT (user_id, tenant_id)
         DO UPDATE SET mfa_secret = $3, updated_at = NOW()`,
        [tenantId, userId, encryptedSecret]
      );

      await client.query('COMMIT');

      return {
        secret: secret.base32,
        qrCode: qrCodeDataUrl,
        otpauthUrl: secret.otpauth_url,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verify TOTP token
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @param {string} token - 6-digit TOTP token
   * @returns {boolean} True if token is valid
   */
  async verifyTOTP(userId, tenantId, token) {
    const client = await this.pool.connect();
    try {
      // Set tenant context for RLS
      await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);

      // Get MFA settings
      const result = await client.query(
        'SELECT mfa_secret FROM mfa_settings WHERE user_id = $1 AND tenant_id = $2',
        [userId, tenantId]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const encryptedSecret = result.rows[0].mfa_secret;
      const secret = this.decryptSecret(encryptedSecret);

      // Verify token with window of 1 (allows for time drift)
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 1,
      });

      if (verified) {
        // Update last verified timestamp
        await client.query(
          'UPDATE mfa_settings SET last_verified_at = NOW() WHERE user_id = $1 AND tenant_id = $2',
          [userId, tenantId]
        );
      }

      return verified;
    } finally {
      client.release();
    }
  }

  /**
   * Enable MFA for a user after successful verification
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @param {string} token - 6-digit TOTP token for verification
   * @returns {Object} Backup codes
   */
  async enableMFA(userId, tenantId, token) {
    // First verify the token
    const verified = await this.verifyTOTP(userId, tenantId, token);
    if (!verified) {
      throw new Error('Invalid TOTP token');
    }

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(10);
    const hashedCodes = backupCodes.map(code => this.hashBackupCode(code));

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Set tenant context for RLS
      await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);

      // Enable MFA and store backup codes
      await client.query(
        `UPDATE mfa_settings 
         SET mfa_enabled = TRUE, backup_codes_hash = $1, backup_codes_used = 0, updated_at = NOW()
         WHERE user_id = $2 AND tenant_id = $3`,
        [hashedCodes, userId, tenantId]
      );

      // Update users table
      await client.query(
        'UPDATE users SET mfa_enabled = TRUE WHERE user_id = $1 AND tenant_id = $2',
        [userId, tenantId]
      );

      // Log audit event
      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, 'mfa_enabled', 'user', $2, '{"method": "totp"}')`,
        [tenantId, userId]
      );

      await client.query('COMMIT');

      return {
        backupCodes: backupCodes,
        message: 'MFA enabled successfully. Save these backup codes in a secure location.',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Disable MFA for a user
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @param {string} token - 6-digit TOTP token or backup code for verification
   * @returns {boolean} True if MFA was disabled
   */
  async disableMFA(userId, tenantId, token) {
    // Verify token or backup code
    const verified = await this.verifyTOTP(userId, tenantId, token) ||
                     await this.verifyBackupCode(userId, tenantId, token);

    if (!verified) {
      throw new Error('Invalid token or backup code');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Set tenant context for RLS
      await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);

      // Disable MFA
      await client.query(
        `UPDATE mfa_settings 
         SET mfa_enabled = FALSE, mfa_secret = NULL, backup_codes_hash = NULL, updated_at = NOW()
         WHERE user_id = $1 AND tenant_id = $2`,
        [userId, tenantId]
      );

      // Update users table
      await client.query(
        'UPDATE users SET mfa_enabled = FALSE WHERE user_id = $1 AND tenant_id = $2',
        [userId, tenantId]
      );

      // Log audit event
      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, 'mfa_disabled', 'user', $2, '{}')`,
        [tenantId, userId]
      );

      await client.query('COMMIT');

      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verify backup code
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @param {string} code - Backup code
   * @returns {boolean} True if code is valid
   */
  async verifyBackupCode(userId, tenantId, code) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Set tenant context for RLS
      await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);

      // Get MFA settings
      const result = await client.query(
        'SELECT backup_codes_hash, backup_codes_used FROM mfa_settings WHERE user_id = $1 AND tenant_id = $2',
        [userId, tenantId]
      );

      if (result.rows.length === 0 || !result.rows[0].backup_codes_hash) {
        await client.query('ROLLBACK');
        return false;
      }

      const hashedCodes = result.rows[0].backup_codes_hash;
      const hashedInput = this.hashBackupCode(code);

      // Check if code exists and hasn't been used
      const codeIndex = hashedCodes.indexOf(hashedInput);
      if (codeIndex === -1) {
        await client.query('ROLLBACK');
        
        // Log failed attempt
        await this.logRecoveryAttempt(userId, tenantId, 'backup_code', false);
        
        return false;
      }

      // Mark code as used by removing it
      const updatedCodes = hashedCodes.filter((_, index) => index !== codeIndex);
      await client.query(
        `UPDATE mfa_settings 
         SET backup_codes_hash = $1, backup_codes_used = backup_codes_used + 1, updated_at = NOW()
         WHERE user_id = $2 AND tenant_id = $3`,
        [updatedCodes, userId, tenantId]
      );

      // Log successful attempt
      await client.query(
        `INSERT INTO mfa_recovery_attempts (tenant_id, user_id, attempt_type, success)
         VALUES ($1, $2, 'backup_code', TRUE)`,
        [tenantId, userId]
      );

      await client.query('COMMIT');

      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Regenerate backup codes
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @param {string} token - 6-digit TOTP token for verification
   * @returns {Object} New backup codes
   */
  async regenerateBackupCodes(userId, tenantId, token) {
    // Verify token
    const verified = await this.verifyTOTP(userId, tenantId, token);
    if (!verified) {
      throw new Error('Invalid TOTP token');
    }

    // Generate new backup codes
    const backupCodes = this.generateBackupCodes(10);
    const hashedCodes = backupCodes.map(code => this.hashBackupCode(code));

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Set tenant context for RLS
      await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);

      // Update backup codes
      await client.query(
        `UPDATE mfa_settings 
         SET backup_codes_hash = $1, backup_codes_used = 0, updated_at = NOW()
         WHERE user_id = $2 AND tenant_id = $3`,
        [hashedCodes, userId, tenantId]
      );

      // Log audit event
      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, 'mfa_backup_codes_regenerated', 'user', $2, '{}')`,
        [tenantId, userId]
      );

      await client.query('COMMIT');

      return {
        backupCodes: backupCodes,
        message: 'Backup codes regenerated successfully. Save these codes in a secure location.',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get MFA status for a user
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @returns {Object} MFA status
   */
  async getMFAStatus(userId, tenantId) {
    const client = await this.pool.connect();
    try {
      // Set tenant context for RLS
      await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);

      const result = await client.query(
        `SELECT mfa_enabled, mfa_method, backup_codes_used, 
                CASE WHEN backup_codes_hash IS NOT NULL THEN array_length(backup_codes_hash, 1) ELSE 0 END as backup_codes_remaining,
                last_verified_at
         FROM mfa_settings 
         WHERE user_id = $1 AND tenant_id = $2`,
        [userId, tenantId]
      );

      if (result.rows.length === 0) {
        return {
          enabled: false,
          method: null,
          backupCodesRemaining: 0,
          lastVerifiedAt: null,
        };
      }

      const row = result.rows[0];
      return {
        enabled: row.mfa_enabled,
        method: row.mfa_method,
        backupCodesRemaining: row.backup_codes_remaining,
        backupCodesUsed: row.backup_codes_used,
        lastVerifiedAt: row.last_verified_at,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Check if MFA is required for a user based on tenant policy
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @returns {Object} MFA requirement status
   */
  async isMFARequired(userId, tenantId) {
    const client = await this.pool.connect();
    try {
      // Set tenant context for RLS
      await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);

      const result = await client.query(
        'SELECT is_mfa_required($1, $2) as required',
        [userId, tenantId]
      );

      return {
        required: result.rows[0].required,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Set tenant MFA policy
   * @param {string} tenantId - Tenant ID
   * @param {Object} policy - MFA policy configuration
   * @returns {Object} Updated policy
   */
  async setTenantMFAPolicy(tenantId, policy) {
    const {
      mfaRequired = false,
      mfaRequiredRoles = [],
      gracePeriodDays = 7,
    } = policy;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Set tenant context for RLS
      await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);

      // Insert or update policy
      const result = await client.query(
        `INSERT INTO tenant_mfa_policy (tenant_id, mfa_required, mfa_required_roles, grace_period_days)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id)
         DO UPDATE SET 
           mfa_required = $2,
           mfa_required_roles = $3,
           grace_period_days = $4,
           updated_at = NOW()
         RETURNING *`,
        [tenantId, mfaRequired, mfaRequiredRoles, gracePeriodDays]
      );

      // Log audit event
      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details)
         VALUES ($1, NULL, 'mfa_policy_updated', 'tenant', $1, $2)`,
        [tenantId, JSON.stringify(policy)]
      );

      await client.query('COMMIT');

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get tenant MFA policy
   * @param {string} tenantId - Tenant ID
   * @returns {Object} MFA policy
   */
  async getTenantMFAPolicy(tenantId) {
    const client = await this.pool.connect();
    try {
      // Set tenant context for RLS
      await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);

      const result = await client.query(
        'SELECT * FROM tenant_mfa_policy WHERE tenant_id = $1',
        [tenantId]
      );

      if (result.rows.length === 0) {
        return {
          mfaRequired: false,
          mfaRequiredRoles: [],
          gracePeriodDays: 7,
        };
      }

      const row = result.rows[0];
      return {
        mfaRequired: row.mfa_required,
        mfaRequiredRoles: row.mfa_required_roles,
        gracePeriodDays: row.grace_period_days,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Generate backup codes
   * @param {number} count - Number of codes to generate
   * @returns {string[]} Array of backup codes
   */
  generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      // Format as XXXX-XXXX
      const formatted = `${code.slice(0, 4)}-${code.slice(4, 8)}`;
      codes.push(formatted);
    }
    return codes;
  }

  /**
   * Hash backup code for storage
   * @param {string} code - Backup code
   * @returns {string} Hashed code
   */
  hashBackupCode(code) {
    return crypto
      .createHash('sha256')
      .update(code.toUpperCase().replace('-', ''))
      .digest('hex');
  }

  /**
   * Encrypt TOTP secret
   * @param {string} secret - TOTP secret
   * @returns {string} Encrypted secret
   */
  encryptSecret(secret) {
    const algorithm = 'aes-256-gcm';
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt TOTP secret
   * @param {string} encryptedSecret - Encrypted secret
   * @returns {string} Decrypted secret
   */
  decryptSecret(encryptedSecret) {
    const algorithm = 'aes-256-gcm';
    const key = this.getEncryptionKey();
    
    const parts = encryptedSecret.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Get encryption key from environment
   * @returns {Buffer} Encryption key
   */
  getEncryptionKey() {
    const key = process.env.MFA_ENCRYPTION_KEY || 'default-key-change-in-production-32';
    return crypto.createHash('sha256').update(key).digest();
  }

  /**
   * Log recovery attempt
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @param {string} attemptType - Type of recovery attempt
   * @param {boolean} success - Whether attempt was successful
   * @param {Object} metadata - Additional metadata (IP, user agent)
   */
  async logRecoveryAttempt(userId, tenantId, attemptType, success, metadata = {}) {
    const client = await this.pool.connect();
    try {
      await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);

      await client.query(
        `INSERT INTO mfa_recovery_attempts (tenant_id, user_id, attempt_type, success, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, userId, attemptType, success, metadata.ip || null, metadata.userAgent || null]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Close database connection pool
   */
  async close() {
    await this.pool.end();
  }
}

// Export singleton instance
const mfaService = new MFAService();

module.exports = mfaService;
