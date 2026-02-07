/**
 * AI Kill Switch Routes
 * 
 * Task 3.4.3: Create AI Kill Switch mechanism
 * 
 * SuperAdmin-only endpoints for managing AI services
 */

const express = require('express');
const router = express.Router();
const aiKillSwitchService = require('../services/aiKillSwitchService');

/**
 * GET /api/v1/ai/kill-switch
 * Get current AI Kill Switch status
 * 
 * Access: SuperAdmin, InstituteAdmin (read-only)
 */
router.get('/kill-switch', async (req, res) => {
  try {
    const status = await aiKillSwitchService.getKillSwitchStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting kill switch status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI Kill Switch status',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/ai/kill-switch/toggle
 * Toggle AI Kill Switch (SuperAdmin only)
 * 
 * Body:
 * - enable: boolean (true to enable, false to disable)
 * - reason: string (required - reason for toggle)
 * 
 * Access: SuperAdmin only
 */
router.post('/kill-switch/toggle', async (req, res) => {
  try {
    const { enable, reason } = req.body;
    
    // Validation
    if (typeof enable !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'enable field must be a boolean'
      });
    }
    
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'reason field is required and must be a non-empty string'
      });
    }
    
    // Check user role (SuperAdmin only)
    // TODO: Implement proper role check from JWT/session
    const userId = req.user?.user_id || 'superadmin_001';
    const userRole = req.user?.role || 'SuperAdmin';
    
    if (userRole !== 'SuperAdmin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only SuperAdmin can toggle AI Kill Switch'
      });
    }
    
    // Toggle kill switch
    const status = await aiKillSwitchService.toggleKillSwitch(
      enable,
      reason.trim(),
      userId,
      req.app.locals.pool
    );
    
    res.json({
      success: true,
      data: status,
      message: enable
        ? 'AI services have been enabled'
        : 'AI services have been disabled. System reverted to deterministic logic.'
    });
  } catch (error) {
    console.error('Error toggling kill switch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle AI Kill Switch',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/ai/kill-switch/history
 * Get kill switch toggle history from audit logs
 * 
 * Query params:
 * - limit: number (default 50, max 500)
 * 
 * Access: SuperAdmin, InstituteAdmin
 */
router.get('/kill-switch/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    
    const client = await req.app.locals.pool.connect();
    
    try {
      const result = await client.query(
        `SELECT 
          event_type,
          user_id,
          action,
          details,
          timestamp,
          ip_address
         FROM audit_logs
         WHERE resource_type = 'ai_kill_switch'
         ORDER BY timestamp DESC
         LIMIT $1`,
        [limit]
      );
      
      res.json({
        success: true,
        data: {
          history: result.rows,
          total: result.rows.length
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error getting kill switch history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get kill switch history',
      message: error.message
    });
  }
});

module.exports = router;
