/**
 * EduOS Platform - MFA Routes Tests
 * 
 * Tests for MFA API endpoints
 * Task: 1.3.4 - Implement multi-factor authentication (MFA)
 */

const request = require('supertest');
const express = require('express');
const mfaRoutes = require('./mfa');
const mfaService = require('../services/mfaService');

// Mock MFA service
jest.mock('../services/mfaService');

const app = express();
app.use(express.json());
app.use('/api/v1/mfa', mfaRoutes);

describe('MFA Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/mfa/setup', () => {
    it('should generate TOTP secret and QR code', async () => {
      const mockResult = {
        secret: 'JBSWY3DPEHPK3PXP',
        qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
        otpauthUrl: 'otpauth://totp/EduOS%20(test@example.com)?secret=JBSWY3DPEHPK3PXP&issuer=EduOS%20Platform',
      };

      mfaService.generateTOTPSecret.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/mfa/setup')
        .send({
          userId: 'user-123',
          email: 'test@example.com',
          tenantId: 'tenant-123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('secret');
      expect(response.body).toHaveProperty('qrCode');
      expect(response.body).toHaveProperty('otpauthUrl');
      expect(mfaService.generateTOTPSecret).toHaveBeenCalledWith(
        'user-123',
        'test@example.com',
        'tenant-123'
      );
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/v1/mfa/setup')
        .send({
          userId: 'user-123',
          // Missing email and tenantId
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 500 on service error', async () => {
      mfaService.generateTOTPSecret.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/v1/mfa/setup')
        .send({
          userId: 'user-123',
          email: 'test@example.com',
          tenantId: 'tenant-123',
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/mfa/enable', () => {
    it('should enable MFA with valid token', async () => {
      const mockResult = {
        backupCodes: ['ABCD-1234', 'EFGH-5678'],
        message: 'MFA enabled successfully',
      };

      mfaService.enableMFA.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/mfa/enable')
        .send({
          userId: 'user-123',
          tenantId: 'tenant-123',
          token: '123456',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('backupCodes');
      expect(response.body.backupCodes).toHaveLength(2);
      expect(mfaService.enableMFA).toHaveBeenCalledWith('user-123', 'tenant-123', '123456');
    });

    it('should return 400 if token is invalid', async () => {
      mfaService.enableMFA.mockRejectedValue(new Error('Invalid TOTP token'));

      const response = await request(app)
        .post('/api/v1/mfa/enable')
        .send({
          userId: 'user-123',
          tenantId: 'tenant-123',
          token: '000000',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/v1/mfa/enable')
        .send({
          userId: 'user-123',
          // Missing tenantId and token
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/mfa/disable', () => {
    it('should disable MFA with valid token', async () => {
      mfaService.disableMFA.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/mfa/disable')
        .send({
          userId: 'user-123',
          tenantId: 'tenant-123',
          token: '123456',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'MFA disabled successfully');
      expect(mfaService.disableMFA).toHaveBeenCalledWith('user-123', 'tenant-123', '123456');
    });

    it('should return 400 if token is invalid', async () => {
      mfaService.disableMFA.mockRejectedValue(new Error('Invalid token'));

      const response = await request(app)
        .post('/api/v1/mfa/disable')
        .send({
          userId: 'user-123',
          tenantId: 'tenant-123',
          token: '000000',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/mfa/verify', () => {
    it('should verify valid TOTP token', async () => {
      mfaService.verifyTOTP.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/mfa/verify')
        .send({
          userId: 'user-123',
          tenantId: 'tenant-123',
          token: '123456',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('verified', true);
      expect(mfaService.verifyTOTP).toHaveBeenCalledWith('user-123', 'tenant-123', '123456');
    });

    it('should reject invalid TOTP token', async () => {
      mfaService.verifyTOTP.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/v1/mfa/verify')
        .send({
          userId: 'user-123',
          tenantId: 'tenant-123',
          token: '000000',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('verified', false);
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/v1/mfa/verify')
        .send({
          userId: 'user-123',
          // Missing tenantId and token
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/mfa/verify-backup', () => {
    it('should verify valid backup code', async () => {
      mfaService.verifyBackupCode.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/mfa/verify-backup')
        .send({
          userId: 'user-123',
          tenantId: 'tenant-123',
          code: 'ABCD-1234',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('verified', true);
      expect(response.body).toHaveProperty('warning');
      expect(mfaService.verifyBackupCode).toHaveBeenCalledWith('user-123', 'tenant-123', 'ABCD-1234');
    });

    it('should reject invalid backup code', async () => {
      mfaService.verifyBackupCode.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/v1/mfa/verify-backup')
        .send({
          userId: 'user-123',
          tenantId: 'tenant-123',
          code: 'INVALID-CODE',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('verified', false);
    });
  });

  describe('POST /api/v1/mfa/regenerate-backup-codes', () => {
    it('should regenerate backup codes with valid token', async () => {
      const mockResult = {
        backupCodes: ['NEW1-CODE', 'NEW2-CODE'],
        message: 'Backup codes regenerated successfully',
      };

      mfaService.regenerateBackupCodes.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/mfa/regenerate-backup-codes')
        .send({
          userId: 'user-123',
          tenantId: 'tenant-123',
          token: '123456',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('backupCodes');
      expect(response.body.backupCodes).toHaveLength(2);
      expect(mfaService.regenerateBackupCodes).toHaveBeenCalledWith('user-123', 'tenant-123', '123456');
    });

    it('should return 400 if token is invalid', async () => {
      mfaService.regenerateBackupCodes.mockRejectedValue(new Error('Invalid TOTP token'));

      const response = await request(app)
        .post('/api/v1/mfa/regenerate-backup-codes')
        .send({
          userId: 'user-123',
          tenantId: 'tenant-123',
          token: '000000',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/mfa/status/:userId/:tenantId', () => {
    it('should return MFA status', async () => {
      const mockStatus = {
        enabled: true,
        method: 'totp',
        backupCodesRemaining: 8,
        backupCodesUsed: 2,
        lastVerifiedAt: new Date(),
      };

      mfaService.getMFAStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/v1/mfa/status/user-123/tenant-123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('enabled', true);
      expect(response.body).toHaveProperty('method', 'totp');
      expect(mfaService.getMFAStatus).toHaveBeenCalledWith('user-123', 'tenant-123');
    });

    it('should return 500 on service error', async () => {
      mfaService.getMFAStatus.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/mfa/status/user-123/tenant-123');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/mfa/required/:userId/:tenantId', () => {
    it('should check if MFA is required', async () => {
      mfaService.isMFARequired.mockResolvedValue({ required: true });

      const response = await request(app)
        .get('/api/v1/mfa/required/user-123/tenant-123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('required', true);
      expect(mfaService.isMFARequired).toHaveBeenCalledWith('user-123', 'tenant-123');
    });
  });

  describe('POST /api/v1/mfa/policy', () => {
    it('should set tenant MFA policy', async () => {
      const mockPolicy = {
        tenant_id: 'tenant-123',
        mfa_required: true,
        mfa_required_roles: ['admin', 'teacher'],
        grace_period_days: 14,
      };

      mfaService.setTenantMFAPolicy.mockResolvedValue(mockPolicy);

      const response = await request(app)
        .post('/api/v1/mfa/policy')
        .send({
          tenantId: 'tenant-123',
          mfaRequired: true,
          mfaRequiredRoles: ['admin', 'teacher'],
          gracePeriodDays: 14,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('policy');
      expect(mfaService.setTenantMFAPolicy).toHaveBeenCalledWith('tenant-123', {
        mfaRequired: true,
        mfaRequiredRoles: ['admin', 'teacher'],
        gracePeriodDays: 14,
      });
    });

    it('should return 400 if tenantId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/mfa/policy')
        .send({
          mfaRequired: true,
          // Missing tenantId
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/mfa/policy/:tenantId', () => {
    it('should get tenant MFA policy', async () => {
      const mockPolicy = {
        mfaRequired: true,
        mfaRequiredRoles: ['admin'],
        gracePeriodDays: 7,
      };

      mfaService.getTenantMFAPolicy.mockResolvedValue(mockPolicy);

      const response = await request(app)
        .get('/api/v1/mfa/policy/tenant-123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('mfaRequired', true);
      expect(mfaService.getTenantMFAPolicy).toHaveBeenCalledWith('tenant-123');
    });

    it('should return 500 on service error', async () => {
      mfaService.getTenantMFAPolicy.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/mfa/policy/tenant-123');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});
