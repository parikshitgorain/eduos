/**
 * EduOS Platform - MFA Service Tests
 * 
 * Tests for multi-factor authentication service
 * Task: 1.3.4 - Implement multi-factor authentication (MFA)
 */

const mfaService = require('./mfaService');
const { Pool } = require('pg');

// Mock pg Pool
jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  const mockPool = {
    connect: jest.fn(() => Promise.resolve(mockClient)),
    end: jest.fn(),
  };

  return {
    Pool: jest.fn(() => mockPool),
  };
});

describe('MFAService', () => {
  let mockPool;
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = new Pool();
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool.connect.mockResolvedValue(mockClient);
  });

  afterAll(async () => {
    await mfaService.close();
  });

  describe('generateTOTPSecret', () => {
    it('should generate TOTP secret and QR code', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const tenantId = 'tenant-123';

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({}) // INSERT mfa_settings
        .mockResolvedValueOnce({}); // COMMIT

      const result = await mfaService.generateTOTPSecret(userId, email, tenantId);

      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCode');
      expect(result).toHaveProperty('otpauthUrl');
      expect(result.secret).toMatch(/^[A-Z2-7]+$/); // Base32 format
      expect(result.qrCode).toMatch(/^data:image\/png;base64,/);
      expect(result.otpauthUrl).toContain('otpauth://totp/');
      expect(result.otpauthUrl).toContain(encodeURIComponent(email));

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO mfa_settings'),
        expect.arrayContaining([tenantId, userId, expect.any(String)])
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback on error', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const tenantId = 'tenant-123';

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockRejectedValueOnce(new Error('Database error')); // INSERT fails

      await expect(
        mfaService.generateTOTPSecret(userId, email, tenantId)
      ).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('verifyTOTP', () => {
    it('should verify valid TOTP token', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-123';

      // Generate a real secret and token for testing
      const speakeasy = require('speakeasy');
      const secret = speakeasy.generateSecret({ length: 32 });
      const token = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32',
      });

      // Encrypt the secret as the service would
      const encryptedSecret = mfaService.encryptSecret(secret.base32);

      mockClient.query
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({
          rows: [{ mfa_secret: encryptedSecret }],
        }) // SELECT mfa_settings
        .mockResolvedValueOnce({}); // UPDATE last_verified_at

      const verified = await mfaService.verifyTOTP(userId, tenantId, token);

      expect(verified).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE mfa_settings'),
        [userId, tenantId]
      );
    });

    it('should reject invalid TOTP token', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-123';
      const invalidToken = '000000';

      const speakeasy = require('speakeasy');
      const secret = speakeasy.generateSecret({ length: 32 });
      const encryptedSecret = mfaService.encryptSecret(secret.base32);

      mockClient.query
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({
          rows: [{ mfa_secret: encryptedSecret }],
        }); // SELECT mfa_settings

      const verified = await mfaService.verifyTOTP(userId, tenantId, invalidToken);

      expect(verified).toBe(false);
    });

    it('should return false if MFA not configured', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-123';
      const token = '123456';

      mockClient.query
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({ rows: [] }); // SELECT mfa_settings (no rows)

      const verified = await mfaService.verifyTOTP(userId, tenantId, token);

      expect(verified).toBe(false);
    });
  });

  describe('enableMFA', () => {
    it('should enable MFA with valid token', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-123';

      // Generate a real secret and token
      const speakeasy = require('speakeasy');
      const secret = speakeasy.generateSecret({ length: 32 });
      const token = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32',
      });

      const encryptedSecret = mfaService.encryptSecret(secret.base32);

      // Mock verifyTOTP
      mockClient.query
        .mockResolvedValueOnce({}) // SET tenant context (verifyTOTP)
        .mockResolvedValueOnce({
          rows: [{ mfa_secret: encryptedSecret }],
        }) // SELECT mfa_settings (verifyTOTP)
        .mockResolvedValueOnce({}) // UPDATE last_verified_at (verifyTOTP)
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({}) // UPDATE mfa_settings
        .mockResolvedValueOnce({}) // UPDATE users
        .mockResolvedValueOnce({}) // INSERT audit_logs
        .mockResolvedValueOnce({}); // COMMIT

      const result = await mfaService.enableMFA(userId, tenantId, token);

      expect(result).toHaveProperty('backupCodes');
      expect(result).toHaveProperty('message');
      expect(result.backupCodes).toHaveLength(10);
      expect(result.backupCodes[0]).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE mfa_settings'),
        expect.arrayContaining([expect.any(Array), userId, tenantId])
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        [userId, tenantId]
      );
    });

    it('should reject invalid token', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-123';
      const invalidToken = '000000';

      const speakeasy = require('speakeasy');
      const secret = speakeasy.generateSecret({ length: 32 });
      const encryptedSecret = mfaService.encryptSecret(secret.base32);

      mockClient.query
        .mockResolvedValueOnce({}) // SET tenant context (verifyTOTP)
        .mockResolvedValueOnce({
          rows: [{ mfa_secret: encryptedSecret }],
        }); // SELECT mfa_settings (verifyTOTP)

      await expect(
        mfaService.enableMFA(userId, tenantId, invalidToken)
      ).rejects.toThrow('Invalid TOTP token');
    });
  });

  describe('disableMFA', () => {
    it('should disable MFA with valid token', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-123';

      const speakeasy = require('speakeasy');
      const secret = speakeasy.generateSecret({ length: 32 });
      const token = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32',
      });

      const encryptedSecret = mfaService.encryptSecret(secret.base32);

      mockClient.query
        .mockResolvedValueOnce({}) // SET tenant context (verifyTOTP)
        .mockResolvedValueOnce({
          rows: [{ mfa_secret: encryptedSecret }],
        }) // SELECT mfa_settings (verifyTOTP)
        .mockResolvedValueOnce({}) // UPDATE last_verified_at (verifyTOTP)
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({}) // UPDATE mfa_settings
        .mockResolvedValueOnce({}) // UPDATE users
        .mockResolvedValueOnce({}) // INSERT audit_logs
        .mockResolvedValueOnce({}); // COMMIT

      const result = await mfaService.disableMFA(userId, tenantId, token);

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE mfa_settings'),
        [userId, tenantId]
      );
    });
  });

  describe('verifyBackupCode', () => {
    it('should verify valid backup code', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-123';
      const code = 'ABCD-1234';

      const hashedCode = mfaService.hashBackupCode(code);
      const hashedCodes = [hashedCode, 'other-hash-1', 'other-hash-2'];

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({
          rows: [
            {
              backup_codes_hash: hashedCodes,
              backup_codes_used: 0,
            },
          ],
        }) // SELECT mfa_settings
        .mockResolvedValueOnce({}) // UPDATE mfa_settings
        .mockResolvedValueOnce({}) // INSERT mfa_recovery_attempts
        .mockResolvedValueOnce({}); // COMMIT

      const verified = await mfaService.verifyBackupCode(userId, tenantId, code);

      expect(verified).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE mfa_settings'),
        expect.arrayContaining([expect.any(Array), userId, tenantId])
      );
    });

    it('should reject invalid backup code', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-123';
      const invalidCode = 'INVALID-CODE';

      const hashedCodes = ['hash-1', 'hash-2', 'hash-3'];

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({
          rows: [
            {
              backup_codes_hash: hashedCodes,
              backup_codes_used: 0,
            },
          ],
        }) // SELECT mfa_settings
        .mockResolvedValueOnce({}); // ROLLBACK

      const verified = await mfaService.verifyBackupCode(userId, tenantId, invalidCode);

      expect(verified).toBe(false);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should reject if no backup codes configured', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-123';
      const code = 'ABCD-1234';

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({ rows: [] }) // SELECT mfa_settings (no rows)
        .mockResolvedValueOnce({}); // ROLLBACK

      const verified = await mfaService.verifyBackupCode(userId, tenantId, code);

      expect(verified).toBe(false);
    });
  });

  describe('regenerateBackupCodes', () => {
    it('should regenerate backup codes with valid token', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-123';

      const speakeasy = require('speakeasy');
      const secret = speakeasy.generateSecret({ length: 32 });
      const token = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32',
      });

      const encryptedSecret = mfaService.encryptSecret(secret.base32);

      mockClient.query
        .mockResolvedValueOnce({}) // SET tenant context (verifyTOTP)
        .mockResolvedValueOnce({
          rows: [{ mfa_secret: encryptedSecret }],
        }) // SELECT mfa_settings (verifyTOTP)
        .mockResolvedValueOnce({}) // UPDATE last_verified_at (verifyTOTP)
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({}) // UPDATE mfa_settings
        .mockResolvedValueOnce({}) // INSERT audit_logs
        .mockResolvedValueOnce({}); // COMMIT

      const result = await mfaService.regenerateBackupCodes(userId, tenantId, token);

      expect(result).toHaveProperty('backupCodes');
      expect(result).toHaveProperty('message');
      expect(result.backupCodes).toHaveLength(10);
    });
  });

  describe('getMFAStatus', () => {
    it('should return MFA status for user', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-123';

      mockClient.query
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({
          rows: [
            {
              mfa_enabled: true,
              mfa_method: 'totp',
              backup_codes_used: 2,
              backup_codes_remaining: 8,
              last_verified_at: new Date(),
            },
          ],
        }); // SELECT mfa_settings

      const status = await mfaService.getMFAStatus(userId, tenantId);

      expect(status).toEqual({
        enabled: true,
        method: 'totp',
        backupCodesRemaining: 8,
        backupCodesUsed: 2,
        lastVerifiedAt: expect.any(Date),
      });
    });

    it('should return default status if MFA not configured', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-123';

      mockClient.query
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({ rows: [] }); // SELECT mfa_settings (no rows)

      const status = await mfaService.getMFAStatus(userId, tenantId);

      expect(status).toEqual({
        enabled: false,
        method: null,
        backupCodesRemaining: 0,
        lastVerifiedAt: null,
      });
    });
  });

  describe('setTenantMFAPolicy', () => {
    it('should set tenant MFA policy', async () => {
      const tenantId = 'tenant-123';
      const policy = {
        mfaRequired: true,
        mfaRequiredRoles: ['admin', 'teacher'],
        gracePeriodDays: 14,
      };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({
          rows: [
            {
              tenant_id: tenantId,
              mfa_required: true,
              mfa_required_roles: ['admin', 'teacher'],
              grace_period_days: 14,
            },
          ],
        }) // INSERT/UPDATE tenant_mfa_policy
        .mockResolvedValueOnce({}) // INSERT audit_logs
        .mockResolvedValueOnce({}); // COMMIT

      const result = await mfaService.setTenantMFAPolicy(tenantId, policy);

      expect(result).toHaveProperty('tenant_id', tenantId);
      expect(result).toHaveProperty('mfa_required', true);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('getTenantMFAPolicy', () => {
    it('should get tenant MFA policy', async () => {
      const tenantId = 'tenant-123';

      mockClient.query
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({
          rows: [
            {
              mfa_required: true,
              mfa_required_roles: ['admin'],
              grace_period_days: 7,
            },
          ],
        }); // SELECT tenant_mfa_policy

      const policy = await mfaService.getTenantMFAPolicy(tenantId);

      expect(policy).toEqual({
        mfaRequired: true,
        mfaRequiredRoles: ['admin'],
        gracePeriodDays: 7,
      });
    });

    it('should return default policy if not configured', async () => {
      const tenantId = 'tenant-123';

      mockClient.query
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({ rows: [] }); // SELECT tenant_mfa_policy (no rows)

      const policy = await mfaService.getTenantMFAPolicy(tenantId);

      expect(policy).toEqual({
        mfaRequired: false,
        mfaRequiredRoles: [],
        gracePeriodDays: 7,
      });
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate specified number of backup codes', () => {
      const codes = mfaService.generateBackupCodes(5);

      expect(codes).toHaveLength(5);
      codes.forEach(code => {
        expect(code).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);
      });
    });

    it('should generate unique codes', () => {
      const codes = mfaService.generateBackupCodes(10);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(10);
    });
  });

  describe('encryption', () => {
    it('should encrypt and decrypt secret correctly', () => {
      const secret = 'JBSWY3DPEHPK3PXP';

      const encrypted = mfaService.encryptSecret(secret);
      expect(encrypted).not.toBe(secret);
      expect(encrypted).toContain(':'); // Contains IV and auth tag

      const decrypted = mfaService.decryptSecret(encrypted);
      expect(decrypted).toBe(secret);
    });

    it('should produce different encrypted values for same secret', () => {
      const secret = 'JBSWY3DPEHPK3PXP';

      const encrypted1 = mfaService.encryptSecret(secret);
      const encrypted2 = mfaService.encryptSecret(secret);

      expect(encrypted1).not.toBe(encrypted2); // Different IVs
      expect(mfaService.decryptSecret(encrypted1)).toBe(secret);
      expect(mfaService.decryptSecret(encrypted2)).toBe(secret);
    });
  });

  describe('hashBackupCode', () => {
    it('should hash backup code consistently', () => {
      const code = 'ABCD-1234';

      const hash1 = mfaService.hashBackupCode(code);
      const hash2 = mfaService.hashBackupCode(code);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });

    it('should be case insensitive', () => {
      const code1 = 'ABCD-1234';
      const code2 = 'abcd-1234';

      const hash1 = mfaService.hashBackupCode(code1);
      const hash2 = mfaService.hashBackupCode(code2);

      expect(hash1).toBe(hash2);
    });

    it('should ignore hyphens', () => {
      const code1 = 'ABCD-1234';
      const code2 = 'ABCD1234';

      const hash1 = mfaService.hashBackupCode(code1);
      const hash2 = mfaService.hashBackupCode(code2);

      expect(hash1).toBe(hash2);
    });
  });
});
