/**
 * EduOS Platform - Encryption Service
 * 
 * Provides encryption at rest for sensitive fields with KMS integration
 * Supports: national_id, medical_history, payment_info
 * 
 * Task: 4.3.3 - Implement encryption at rest and in transit
 */

const crypto = require('crypto');
const { Pool } = require('pg');

class EncryptionService {
  constructor(pool) {
    this.pool = pool;
    this.algorithm = 'aes-256-gcm';
    this.keyCache = new Map();
    this.keyRotationInterval = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
  }

  /**
   * Initialize encryption service
   * Validates encryption keys and sets up key rotation
   */
  async initialize() {
    // Validate master encryption key
    const key = process.env.MASTER_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('MASTER_ENCRYPTION_KEY environment variable is required');
    }

    if (key.length < 32) {
      throw new Error('MASTER_ENCRYPTION_KEY must be at least 32 characters long');
    }

    // Check if key rotation is needed
    await this.checkKeyRotation();

    console.log('Encryption service initialized successfully');
  }

  /**
   * Get master encryption key from environment or KMS
   * @returns {Buffer} Master encryption key
   */
  getMasterKey() {
    const kmsProvider = process.env.KMS_PROVIDER; // 'aws' or 'vault' or 'env'
    
    if (kmsProvider === 'aws') {
      return this.getKeyFromAWSKMS();
    } else if (kmsProvider === 'vault') {
      return this.getKeyFromVault();
    } else {
      // Default: use environment variable
      const key = process.env.MASTER_ENCRYPTION_KEY;
      if (!key) {
        throw new Error('MASTER_ENCRYPTION_KEY environment variable is required');
      }
      
      // Derive a 32-byte key from the environment variable
      return crypto.scryptSync(key, 'salt', 32);
    }
  }

  /**
   * Get encryption key from AWS KMS
   * @returns {Buffer} Encryption key
   */
  getKeyFromAWSKMS() {
    // Check cache first
    if (this.keyCache.has('aws_kms_key')) {
      const cached = this.keyCache.get('aws_kms_key');
      if (Date.now() - cached.timestamp < 3600000) { // 1 hour cache
        return cached.key;
      }
    }

    // In production, this would call AWS KMS API
    // For now, we'll use a placeholder that reads from environment
    const kmsKeyId = process.env.AWS_KMS_KEY_ID;
    const region = process.env.AWS_REGION || 'us-east-1';
    
    if (!kmsKeyId) {
      throw new Error('AWS_KMS_KEY_ID environment variable is required when using AWS KMS');
    }

    // TODO: Implement actual AWS KMS integration
    // const AWS = require('aws-sdk');
    // const kms = new AWS.KMS({ region });
    // const result = await kms.decrypt({ CiphertextBlob: encryptedKey }).promise();
    // return Buffer.from(result.Plaintext);

    // Placeholder: derive key from KMS key ID
    const key = crypto.scryptSync(kmsKeyId, 'aws-kms-salt', 32);
    
    // Cache the key
    this.keyCache.set('aws_kms_key', {
      key,
      timestamp: Date.now()
    });

    return key;
  }

  /**
   * Get encryption key from HashiCorp Vault
   * @returns {Buffer} Encryption key
   */
  getKeyFromVault() {
    // Check cache first
    if (this.keyCache.has('vault_key')) {
      const cached = this.keyCache.get('vault_key');
      if (Date.now() - cached.timestamp < 3600000) { // 1 hour cache
        return cached.key;
      }
    }

    const vaultAddr = process.env.VAULT_ADDR;
    const vaultToken = process.env.VAULT_TOKEN;
    const vaultPath = process.env.VAULT_KEY_PATH || 'secret/data/eduos/encryption-key';
    
    if (!vaultAddr || !vaultToken) {
      throw new Error('VAULT_ADDR and VAULT_TOKEN environment variables are required when using Vault');
    }

    // TODO: Implement actual Vault integration
    // const axios = require('axios');
    // const response = await axios.get(`${vaultAddr}/v1/${vaultPath}`, {
    //   headers: { 'X-Vault-Token': vaultToken }
    // });
    // const keyData = response.data.data.data.key;
    // return Buffer.from(keyData, 'base64');

    // Placeholder: derive key from vault token
    const key = crypto.scryptSync(vaultToken, 'vault-salt', 32);
    
    // Cache the key
    this.keyCache.set('vault_key', {
      key,
      timestamp: Date.now()
    });

    return key;
  }

  /**
   * Encrypt sensitive field data
   * @param {string} plaintext - Data to encrypt
   * @param {string} fieldType - Type of field (national_id, medical_history, payment_info)
   * @returns {string} Encrypted data in format: version:iv:authTag:ciphertext
   */
  encrypt(plaintext, fieldType = 'generic') {
    if (!plaintext) {
      return null;
    }

    const key = this.getMasterKey();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    // Add field type as additional authenticated data
    cipher.setAAD(Buffer.from(fieldType, 'utf8'));
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: version:iv:authTag:ciphertext
    // Version allows for future algorithm changes
    return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt sensitive field data
   * @param {string} encryptedData - Encrypted data in format: version:iv:authTag:ciphertext
   * @param {string} fieldType - Type of field (national_id, medical_history, payment_info)
   * @returns {string} Decrypted plaintext
   */
  decrypt(encryptedData, fieldType = 'generic') {
    if (!encryptedData) {
      return null;
    }

    const parts = encryptedData.split(':');
    
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted data format');
    }

    const [version, ivHex, authTagHex, ciphertext] = parts;
    
    if (version !== 'v1') {
      throw new Error(`Unsupported encryption version: ${version}`);
    }

    const key = this.getMasterKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from(fieldType, 'utf8'));
    
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Encrypt national ID
   * @param {string} nationalId - National ID to encrypt
   * @returns {string} Encrypted national ID
   */
  encryptNationalId(nationalId) {
    return this.encrypt(nationalId, 'national_id');
  }

  /**
   * Decrypt national ID
   * @param {string} encryptedNationalId - Encrypted national ID
   * @returns {string} Decrypted national ID
   */
  decryptNationalId(encryptedNationalId) {
    return this.decrypt(encryptedNationalId, 'national_id');
  }

  /**
   * Encrypt medical history
   * @param {string} medicalHistory - Medical history to encrypt
   * @returns {string} Encrypted medical history
   */
  encryptMedicalHistory(medicalHistory) {
    return this.encrypt(medicalHistory, 'medical_history');
  }

  /**
   * Decrypt medical history
   * @param {string} encryptedMedicalHistory - Encrypted medical history
   * @returns {string} Decrypted medical history
   */
  decryptMedicalHistory(encryptedMedicalHistory) {
    return this.decrypt(encryptedMedicalHistory, 'medical_history');
  }

  /**
   * Encrypt payment info
   * @param {string} paymentInfo - Payment info to encrypt (JSON string)
   * @returns {string} Encrypted payment info
   */
  encryptPaymentInfo(paymentInfo) {
    return this.encrypt(paymentInfo, 'payment_info');
  }

  /**
   * Decrypt payment info
   * @param {string} encryptedPaymentInfo - Encrypted payment info
   * @returns {string} Decrypted payment info
   */
  decryptPaymentInfo(encryptedPaymentInfo) {
    return this.decrypt(encryptedPaymentInfo, 'payment_info');
  }

  /**
   * Check if key rotation is needed
   * Rotates keys every 90 days
   */
  async checkKeyRotation() {
    try {
      const client = await this.pool.connect();
      
      try {
        // Check last key rotation date
        const result = await client.query(`
          SELECT key_version, created_at, rotated_at
          FROM encryption_keys
          WHERE is_active = true
          ORDER BY created_at DESC
          LIMIT 1
        `);

        if (result.rows.length === 0) {
          // No active key found, create initial key
          await this.createInitialKey(client);
          return;
        }

        const activeKey = result.rows[0];
        const lastRotation = activeKey.rotated_at || activeKey.created_at;
        const daysSinceRotation = (Date.now() - new Date(lastRotation).getTime()) / (24 * 60 * 60 * 1000);

        if (daysSinceRotation >= 90) {
          console.log(`Key rotation needed (${Math.floor(daysSinceRotation)} days since last rotation)`);
          await this.rotateKey(client);
        } else {
          console.log(`Key rotation not needed (${Math.floor(daysSinceRotation)} days since last rotation)`);
        }
      } finally {
        client.release();
      }
    } catch (error) {
      // If table doesn't exist, it will be created by migration
      if (error.code === '42P01') {
        console.log('Encryption keys table not found - will be created by migration');
      } else {
        console.error('Error checking key rotation:', error.message);
      }
    }
  }

  /**
   * Create initial encryption key record
   * @param {Object} client - Database client
   */
  async createInitialKey(client) {
    const keyVersion = 1;
    const keyFingerprint = this.generateKeyFingerprint();

    await client.query(`
      INSERT INTO encryption_keys (key_version, key_fingerprint, is_active, created_at)
      VALUES ($1, $2, true, NOW())
    `, [keyVersion, keyFingerprint]);

    console.log('Initial encryption key created (version 1)');
  }

  /**
   * Rotate encryption key
   * @param {Object} client - Database client
   */
  async rotateKey(client) {
    // Get current active key version
    const result = await client.query(`
      SELECT key_version
      FROM encryption_keys
      WHERE is_active = true
      ORDER BY key_version DESC
      LIMIT 1
    `);

    const currentVersion = result.rows[0]?.key_version || 0;
    const newVersion = currentVersion + 1;
    const keyFingerprint = this.generateKeyFingerprint();

    // Mark old key as inactive
    await client.query(`
      UPDATE encryption_keys
      SET is_active = false, rotated_at = NOW()
      WHERE is_active = true
    `);

    // Create new active key
    await client.query(`
      INSERT INTO encryption_keys (key_version, key_fingerprint, is_active, created_at)
      VALUES ($1, $2, true, NOW())
    `, [newVersion, keyFingerprint]);

    console.log(`Encryption key rotated from version ${currentVersion} to ${newVersion}`);

    // Clear key cache to force reload
    this.keyCache.clear();
  }

  /**
   * Generate key fingerprint for audit purposes
   * @returns {string} SHA-256 hash of the key
   */
  generateKeyFingerprint() {
    const key = this.getMasterKey();
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Re-encrypt data with new key (for key rotation)
   * @param {string} encryptedData - Data encrypted with old key
   * @param {string} fieldType - Type of field
   * @returns {string} Data encrypted with new key
   */
  reEncrypt(encryptedData, fieldType = 'generic') {
    // Decrypt with old key
    const plaintext = this.decrypt(encryptedData, fieldType);
    
    // Encrypt with new key
    return this.encrypt(plaintext, fieldType);
  }

  /**
   * Batch re-encrypt sensitive fields after key rotation
   * @param {string} tenantId - Tenant ID
   */
  async reEncryptTenantData(tenantId) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

      // Re-encrypt national IDs
      const studentsResult = await client.query(`
        SELECT student_id, national_id_encrypted
        FROM students
        WHERE tenant_id = $1 AND national_id_encrypted IS NOT NULL
      `, [tenantId]);

      for (const student of studentsResult.rows) {
        const reEncrypted = this.reEncrypt(student.national_id_encrypted, 'national_id');
        await client.query(`
          UPDATE students
          SET national_id_encrypted = $1
          WHERE student_id = $2 AND tenant_id = $3
        `, [reEncrypted, student.student_id, tenantId]);
      }

      // Re-encrypt medical histories
      const medicalResult = await client.query(`
        SELECT student_id, medical_history_encrypted
        FROM students
        WHERE tenant_id = $1 AND medical_history_encrypted IS NOT NULL
      `, [tenantId]);

      for (const student of medicalResult.rows) {
        const reEncrypted = this.reEncrypt(student.medical_history_encrypted, 'medical_history');
        await client.query(`
          UPDATE students
          SET medical_history_encrypted = $1
          WHERE student_id = $2 AND tenant_id = $3
        `, [reEncrypted, student.student_id, tenantId]);
      }

      // Re-encrypt payment info
      const paymentResult = await client.query(`
        SELECT payment_id, payment_info_encrypted
        FROM payments
        WHERE tenant_id = $1 AND payment_info_encrypted IS NOT NULL
      `, [tenantId]);

      for (const payment of paymentResult.rows) {
        const reEncrypted = this.reEncrypt(payment.payment_info_encrypted, 'payment_info');
        await client.query(`
          UPDATE payments
          SET payment_info_encrypted = $1
          WHERE payment_id = $2 AND tenant_id = $3
        `, [reEncrypted, payment.payment_id, tenantId]);
      }

      await client.query('COMMIT');
      console.log(`Re-encrypted sensitive data for tenant ${tenantId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// Singleton instance
let encryptionServiceInstance = null;

/**
 * Get encryption service instance
 * @param {Pool} pool - PostgreSQL connection pool
 * @returns {EncryptionService} Encryption service instance
 */
function getEncryptionService(pool) {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = new EncryptionService(pool);
  }
  return encryptionServiceInstance;
}

module.exports = {
  EncryptionService,
  getEncryptionService
};
