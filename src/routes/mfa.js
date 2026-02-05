/**
 * EduOS Platform - MFA Routes
 * 
 * API endpoints for multi-factor authentication
 * Task: 1.3.4 - Implement multi-factor authentication (MFA)
 */

const express = require('express');
const mfaService = require('../services/mfaService');

const router = express.Router();

/**
 * POST /api/v1/mfa/setup
 * Generate TOTP secret and QR code for MFA setup
 */
router.post('/setup', async (req, res) => {
  try {
    const { userId, email, tenantId } = req.body;

    if (!userId || !email || !tenantId) {
      return res.status(400).json({
        error: 'Missing required fields: userId, email, tenantId',
      });
    }

    const result = await mfaService.generateTOTPSecret(userId, email, tenantId);

    res.status(200).json({
      message: 'MFA setup initiated. Scan the QR code with your authenticator app.',
      secret: result.secret,
      qrCode: result.qrCode,
      otpauthUrl: result.otpauthUrl,
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({
      error: 'Failed to setup MFA',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/mfa/enable
 * Enable MFA after verifying TOTP token
 */
router.post('/enable', async (req, res) => {
  try {
    const { userId, tenantId, token } = req.body;

    if (!userId || !tenantId || !token) {
      return res.status(400).json({
        error: 'Missing required fields: userId, tenantId, token',
      });
    }

    const result = await mfaService.enableMFA(userId, tenantId, token);

    res.status(200).json({
      message: result.message,
      backupCodes: result.backupCodes,
    });
  } catch (error) {
    console.error('MFA enable error:', error);
    res.status(400).json({
      error: 'Failed to enable MFA',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/mfa/disable
 * Disable MFA for a user
 */
router.post('/disable', async (req, res) => {
  try {
    const { userId, tenantId, token } = req.body;

    if (!userId || !tenantId || !token) {
      return res.status(400).json({
        error: 'Missing required fields: userId, tenantId, token',
      });
    }

    await mfaService.disableMFA(userId, tenantId, token);

    res.status(200).json({
      message: 'MFA disabled successfully',
    });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(400).json({
      error: 'Failed to disable MFA',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/mfa/verify
 * Verify TOTP token
 */
router.post('/verify', async (req, res) => {
  try {
    const { userId, tenantId, token } = req.body;

    if (!userId || !tenantId || !token) {
      return res.status(400).json({
        error: 'Missing required fields: userId, tenantId, token',
      });
    }

    const verified = await mfaService.verifyTOTP(userId, tenantId, token);

    if (verified) {
      res.status(200).json({
        message: 'Token verified successfully',
        verified: true,
      });
    } else {
      res.status(401).json({
        error: 'Invalid token',
        verified: false,
      });
    }
  } catch (error) {
    console.error('MFA verify error:', error);
    res.status(500).json({
      error: 'Failed to verify token',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/mfa/verify-backup
 * Verify backup code
 */
router.post('/verify-backup', async (req, res) => {
  try {
    const { userId, tenantId, code } = req.body;

    if (!userId || !tenantId || !code) {
      return res.status(400).json({
        error: 'Missing required fields: userId, tenantId, code',
      });
    }

    const verified = await mfaService.verifyBackupCode(userId, tenantId, code);

    if (verified) {
      res.status(200).json({
        message: 'Backup code verified successfully',
        verified: true,
        warning: 'This backup code has been used and cannot be used again.',
      });
    } else {
      res.status(401).json({
        error: 'Invalid backup code',
        verified: false,
      });
    }
  } catch (error) {
    console.error('Backup code verify error:', error);
    res.status(500).json({
      error: 'Failed to verify backup code',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/mfa/regenerate-backup-codes
 * Regenerate backup codes
 */
router.post('/regenerate-backup-codes', async (req, res) => {
  try {
    const { userId, tenantId, token } = req.body;

    if (!userId || !tenantId || !token) {
      return res.status(400).json({
        error: 'Missing required fields: userId, tenantId, token',
      });
    }

    const result = await mfaService.regenerateBackupCodes(userId, tenantId, token);

    res.status(200).json({
      message: result.message,
      backupCodes: result.backupCodes,
    });
  } catch (error) {
    console.error('Backup codes regeneration error:', error);
    res.status(400).json({
      error: 'Failed to regenerate backup codes',
      details: error.message,
    });
  }
});

/**
 * GET /api/v1/mfa/status/:userId/:tenantId
 * Get MFA status for a user
 */
router.get('/status/:userId/:tenantId', async (req, res) => {
  try {
    const { userId, tenantId } = req.params;

    const status = await mfaService.getMFAStatus(userId, tenantId);

    res.status(200).json(status);
  } catch (error) {
    console.error('MFA status error:', error);
    res.status(500).json({
      error: 'Failed to get MFA status',
      details: error.message,
    });
  }
});

/**
 * GET /api/v1/mfa/required/:userId/:tenantId
 * Check if MFA is required for a user
 */
router.get('/required/:userId/:tenantId', async (req, res) => {
  try {
    const { userId, tenantId } = req.params;

    const result = await mfaService.isMFARequired(userId, tenantId);

    res.status(200).json(result);
  } catch (error) {
    console.error('MFA required check error:', error);
    res.status(500).json({
      error: 'Failed to check MFA requirement',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/mfa/policy
 * Set tenant MFA policy
 */
router.post('/policy', async (req, res) => {
  try {
    const { tenantId, mfaRequired, mfaRequiredRoles, gracePeriodDays } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        error: 'Missing required field: tenantId',
      });
    }

    const policy = await mfaService.setTenantMFAPolicy(tenantId, {
      mfaRequired,
      mfaRequiredRoles,
      gracePeriodDays,
    });

    res.status(200).json({
      message: 'MFA policy updated successfully',
      policy: policy,
    });
  } catch (error) {
    console.error('MFA policy update error:', error);
    res.status(500).json({
      error: 'Failed to update MFA policy',
      details: error.message,
    });
  }
});

/**
 * GET /api/v1/mfa/policy/:tenantId
 * Get tenant MFA policy
 */
router.get('/policy/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const policy = await mfaService.getTenantMFAPolicy(tenantId);

    res.status(200).json(policy);
  } catch (error) {
    console.error('MFA policy get error:', error);
    res.status(500).json({
      error: 'Failed to get MFA policy',
      details: error.message,
    });
  }
});

module.exports = router;
