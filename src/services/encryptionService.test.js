/**
 * Tests for Encryption Service
 * Task: 4.3.3 - Implement encryption at rest and in transit
 */

const { EncryptionService } = require('./encryptionService');
const crypto = require('crypto');

describe('EncryptionService', () => {
  let encryptionService;
  let mockPool;
  let mockClient;

  beforeEach(() => {
    // Set encryption key for tests
    process.env.MASTER_ENCRYPTION_KEY = 'test_master_encryption_key_32_characters_minimum_12345';
    process.env.KMS_PROVIDER = 'env'; // Use environment variable for tests

    // Mock database pool and client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient)
    };

    encryptionService = new EncryptionService(mockPool);
  });

  afterEach(() => {
    delete process.env.MASTER_ENCRYPTION_KEY;
    delete process.env.KMS_PROVIDER;
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully with valid master key', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // No existing keys

      await expect(encryptionService.initialize()).resolves.not.toThrow();
    });

    it('should throw error if master key is missing', async () => {
      delete process.env.MASTER_ENCRYPTION_KEY;

      await expect(encryptionService.initialize()).rejects.toThrow(
        'MASTER_ENCRYPTION_KEY environment variable is required'
      );
    });

    it('should throw error if master key is too short', async () => {
      process.env.MASTER_ENCRYPTION_KEY = 'short_key';

      await expect(encryptionService.initialize()).rejects.toThrow(
        'MASTER_ENCRYPTION_KEY must be at least 32 characters long'
      );
    });
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt data correctly', () => {
      const plaintext = 'sensitive_data_12345';
      const encrypted = encryptionService.encrypt(plaintext);

      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toMatch(/^v1:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);

      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should return null for null input', () => {
      expect(encryptionService.encrypt(null)).toBeNull();
      expect(encryptionService.decrypt(null)).toBeNull();
    });

    it('should use field type as additional authenticated data', () => {
      const plaintext = 'test_data';
      const encrypted = encryptionService.encrypt(plaintext, 'national_id');

      // Should decrypt successfully with correct field type
      const decrypted = encryptionService.decrypt(encrypted, 'national_id');
      expect(decrypted).toBe(plaintext);

      // Should fail with incorrect field type
      expect(() => {
        encryptionService.decrypt(encrypted, 'wrong_type');
      }).toThrow();
    });

    it('should generate different ciphertext for same plaintext', () => {
      const plaintext = 'test_data';
      const encrypted1 = encryptionService.encrypt(plaintext);
      const encrypted2 = encryptionService.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
      expect(encryptionService.decrypt(encrypted1)).toBe(plaintext);
      expect(encryptionService.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should throw error for invalid encrypted data format', () => {
      expect(() => {
        encryptionService.decrypt('invalid_format');
      }).toThrow('Invalid encrypted data format');
    });

    it('should throw error for unsupported version', () => {
      expect(() => {
        encryptionService.decrypt('v2:aabbcc:ddeeff:112233');
      }).toThrow('Unsupported encryption version: v2');
    });
  });

  describe('encryptNationalId and decryptNationalId', () => {
    it('should encrypt and decrypt national ID', () => {
      const nationalId = '1234-5678-9012';
      const encrypted = encryptionService.encryptNationalId(nationalId);

      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(nationalId);

      const decrypted = encryptionService.decryptNationalId(encrypted);
      expect(decrypted).toBe(nationalId);
    });
  });

  describe('encryptMedicalHistory and decryptMedicalHistory', () => {
    it('should encrypt and decrypt medical history', () => {
      const medicalHistory = 'Patient has diabetes and hypertension';
      const encrypted = encryptionService.encryptMedicalHistory(medicalHistory);

      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(medicalHistory);

      const decrypted = encryptionService.decryptMedicalHistory(encrypted);
      expect(decrypted).toBe(medicalHistory);
    });
  });

  describe('encryptPaymentInfo and decryptPaymentInfo', () => {
    it('should encrypt and decrypt payment info', () => {
      const paymentInfo = JSON.stringify({
        cardNumber: '4111111111111111',
        cvv: '123',
        expiryDate: '12/25'
      });
      const encrypted = encryptionService.encryptPaymentInfo(paymentInfo);

      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(paymentInfo);

      const decrypted = encryptionService.decryptPaymentInfo(encrypted);
      expect(decrypted).toBe(paymentInfo);
    });
  });

  describe('getMasterKey', () => {
    it('should derive key from environment variable', () => {
      const key = encryptionService.getMasterKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should use AWS KMS when configured', () => {
      process.env.KMS_PROVIDER = 'aws';
      process.env.AWS_KMS_KEY_ID = 'test-kms-key-id';
      process.env.AWS_REGION = 'us-east-1';

      const key = encryptionService.getMasterKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should use HashiCorp Vault when configured', () => {
      process.env.KMS_PROVIDER = 'vault';
      process.env.VAULT_ADDR = 'http://localhost:8200';
      process.env.VAULT_TOKEN = 'test-vault-token';

      const key = encryptionService.getMasterKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should throw error if AWS KMS key ID is missing', () => {
      process.env.KMS_PROVIDER = 'aws';
      delete process.env.AWS_KMS_KEY_ID;

      expect(() => {
        encryptionService.getMasterKey();
      }).toThrow('AWS_KMS_KEY_ID environment variable is required when using AWS KMS');
    });

    it('should throw error if Vault credentials are missing', () => {
      process.env.KMS_PROVIDER = 'vault';
      delete process.env.VAULT_ADDR;

      expect(() => {
        encryptionService.getMasterKey();
      }).toThrow('VAULT_ADDR and VAULT_TOKEN environment variables are required when using Vault');
    });
  });

  describe('checkKeyRotation', () => {
    it('should create initial key if none exists', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }); // No existing keys

      await encryptionService.checkKeyRotation();

      // Should query for existing keys and create initial key
      expect(mockClient.query).toHaveBeenCalledTimes(2);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT key_version')
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO encryption_keys'),
        expect.arrayContaining([1, expect.any(String)])
      );
    });

    it('should not rotate key if less than 90 days old', async () => {
      const recentDate = new Date();
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{
            key_version: 1,
            created_at: recentDate,
            rotated_at: null
          }]
        });

      await encryptionService.checkKeyRotation();

      // Should only query, not update
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it('should handle missing encryption_keys table gracefully', async () => {
      const error = new Error('relation "encryption_keys" does not exist');
      error.code = '42P01';
      mockClient.query.mockRejectedValueOnce(error);

      await expect(encryptionService.checkKeyRotation()).resolves.not.toThrow();
    });
  });

  describe('generateKeyFingerprint', () => {
    it('should generate consistent fingerprint for same key', () => {
      const fingerprint1 = encryptionService.generateKeyFingerprint();
      const fingerprint2 = encryptionService.generateKeyFingerprint();

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
    });
  });

  describe('reEncrypt', () => {
    it('should re-encrypt data with new key', () => {
      const plaintext = 'test_data';
      const encrypted1 = encryptionService.encrypt(plaintext);

      const reEncrypted = encryptionService.reEncrypt(encrypted1);

      expect(reEncrypted).not.toBe(encrypted1);
      expect(encryptionService.decrypt(reEncrypted)).toBe(plaintext);
    });
  });

  describe('reEncryptTenantData', () => {
    it('should re-encrypt all tenant sensitive data', async () => {
      const tenantId = 'tenant-123';

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({ // SELECT students with national_id
          rows: [{
            student_id: 'student-1',
            national_id_encrypted: encryptionService.encryptNationalId('1234-5678')
          }]
        })
        .mockResolvedValueOnce({}) // UPDATE student national_id
        .mockResolvedValueOnce({ // SELECT students with medical_history
          rows: [{
            student_id: 'student-1',
            medical_history_encrypted: encryptionService.encryptMedicalHistory('Test history')
          }]
        })
        .mockResolvedValueOnce({}) // UPDATE student medical_history
        .mockResolvedValueOnce({ // SELECT payments
          rows: [{
            payment_id: 'payment-1',
            payment_info_encrypted: encryptionService.encryptPaymentInfo('{"card": "1234"}')
          }]
        })
        .mockResolvedValueOnce({}) // UPDATE payment
        .mockResolvedValueOnce({}); // COMMIT

      await encryptionService.reEncryptTenantData(tenantId);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const tenantId = 'tenant-123';

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockRejectedValueOnce(new Error('Database error')); // SELECT fails

      await expect(encryptionService.reEncryptTenantData(tenantId)).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('key caching', () => {
    it('should cache KMS keys', () => {
      process.env.KMS_PROVIDER = 'aws';
      process.env.AWS_KMS_KEY_ID = 'test-key-id';

      const key1 = encryptionService.getMasterKey();
      const key2 = encryptionService.getMasterKey();

      expect(key1).toEqual(key2);
      expect(encryptionService.keyCache.size).toBeGreaterThan(0);
    });

    it('should respect cache TTL', () => {
      process.env.KMS_PROVIDER = 'aws';
      process.env.AWS_KMS_KEY_ID = 'test-key-id';

      // Get key and cache it
      encryptionService.getMasterKey();

      // Manually expire cache
      const cached = encryptionService.keyCache.get('aws_kms_key');
      cached.timestamp = Date.now() - 3700000; // 1 hour + 1 minute ago

      // Should fetch new key
      const key = encryptionService.getMasterKey();
      expect(key).toBeInstanceOf(Buffer);
    });
  });

  describe('encryption format', () => {
    it('should use correct format: version:iv:authTag:ciphertext', () => {
      const plaintext = 'test';
      const encrypted = encryptionService.encrypt(plaintext);

      const parts = encrypted.split(':');
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe('v1');
      expect(parts[1]).toMatch(/^[0-9a-f]{32}$/); // 16 bytes IV in hex
      expect(parts[2]).toMatch(/^[0-9a-f]{32}$/); // 16 bytes auth tag in hex
      expect(parts[3]).toMatch(/^[0-9a-f]+$/); // Ciphertext in hex
    });
  });

  describe('security properties', () => {
    it('should use AES-256-GCM algorithm', () => {
      expect(encryptionService.algorithm).toBe('aes-256-gcm');
    });

    it('should use authenticated encryption', () => {
      const plaintext = 'test';
      const encrypted = encryptionService.encrypt(plaintext);

      // Tamper with auth tag (not ciphertext, as that might still be valid hex)
      const parts = encrypted.split(':');
      const authTag = parts[2];
      // Flip some bits in the auth tag
      const tamperedAuthTag = authTag.split('').map((c, i) => 
        i === 0 ? (c === '0' ? '1' : '0') : c
      ).join('');
      parts[2] = tamperedAuthTag;
      const tampered = parts.join(':');

      // Should fail authentication
      expect(() => {
        encryptionService.decrypt(tampered);
      }).toThrow();
    });

    it('should use random IV for each encryption', () => {
      const plaintext = 'test';
      const encrypted1 = encryptionService.encrypt(plaintext);
      const encrypted2 = encryptionService.encrypt(plaintext);

      const iv1 = encrypted1.split(':')[1];
      const iv2 = encrypted2.split(':')[1];

      expect(iv1).not.toBe(iv2);
    });
  });
});
