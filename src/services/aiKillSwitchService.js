/**
 * AI Kill Switch Service
 * 
 * Task 3.4.3: Create AI Kill Switch mechanism
 * 
 * Features:
 * - Toggle AI services on/off
 * - Store kill switch state in Redis
 * - Notify all admins when toggled
 * - Audit log all kill switch events
 * - Fallback to deterministic logic when disabled
 */

const { redis } = require('../config/redis');
const axios = require('axios');

// Redis key for kill switch status
const KILL_SWITCH_KEY = 'ai:kill_switch:status';

// AI Service URL (from environment or default)
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Get current AI Kill Switch status
 * 
 * @returns {Promise<Object>} Kill switch status
 */
async function getKillSwitchStatus() {
  try {
    // Try to get from Redis first (faster)
    const cachedStatus = await redis.get(KILL_SWITCH_KEY);
    if (cachedStatus) {
      return JSON.parse(cachedStatus);
    }
    
    // Fallback to AI service
    const response = await axios.get(`${AI_SERVICE_URL}/api/v1/kill-switch`);
    
    // Cache in Redis
    await redis.set(KILL_SWITCH_KEY, JSON.stringify(response.data));
    
    return response.data;
  } catch (error) {
    console.error('Error getting kill switch status:', error.message);
    
    // Default to enabled if we can't determine status
    return {
      enabled: true,
      disabled_at: null,
      disabled_by: null,
      reason: null
    };
  }
}

/**
 * Toggle AI Kill Switch
 * 
 * @param {boolean} enable - True to enable AI, false to disable
 * @param {string} reason - Reason for toggling
 * @param {string} toggledBy - User ID of the SuperAdmin
 * @param {Object} pool - Database connection pool
 * @returns {Promise<Object>} Updated kill switch status
 */
async function toggleKillSwitch(enable, reason, toggledBy, pool) {
  try {
    // Call AI service to toggle kill switch
    const response = await axios.post(`${AI_SERVICE_URL}/api/v1/kill-switch`, {
      enable,
      reason,
      toggled_by: toggledBy
    });
    
    const status = response.data;
    
    // Update Redis cache
    await redis.set(KILL_SWITCH_KEY, JSON.stringify(status));
    
    // Log to database audit trail
    await logKillSwitchEvent(enable, reason, toggledBy, pool);
    
    // Notify all admins
    await notifyAdmins(enable, reason, toggledBy, pool);
    
    return status;
  } catch (error) {
    console.error('Error toggling kill switch:', error.message);
    throw new Error(`Failed to toggle AI Kill Switch: ${error.message}`);
  }
}

/**
 * Log kill switch event to database audit trail
 * 
 * @param {boolean} enable - True if enabling, false if disabling
 * @param {string} reason - Reason for toggle
 * @param {string} toggledBy - User ID
 * @param {Object} pool - Database connection pool
 */
async function logKillSwitchEvent(enable, reason, toggledBy, pool) {
  const client = await pool.connect();
  
  try {
    const action = enable ? 'AI_KILL_SWITCH_ENABLED' : 'AI_KILL_SWITCH_DISABLED';
    
    await client.query(
      `INSERT INTO audit_logs (
        event_type,
        user_id,
        resource_type,
        resource_id,
        action,
        details,
        ip_address,
        user_agent,
        timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        'AI_GOVERNANCE',
        toggledBy,
        'ai_kill_switch',
        'global',
        action,
        JSON.stringify({
          enabled: enable,
          reason,
          toggled_by: toggledBy,
          timestamp: new Date().toISOString()
        }),
        null, // IP address (can be added from request)
        null  // User agent (can be added from request)
      ]
    );
    
    console.log(`Kill switch event logged: ${action} by ${toggledBy}`);
  } catch (error) {
    console.error('Error logging kill switch event:', error);
    // Don't throw - logging failure shouldn't prevent toggle
  } finally {
    client.release();
  }
}

/**
 * Notify all admins about kill switch toggle
 * 
 * @param {boolean} enable - True if enabling, false if disabling
 * @param {string} reason - Reason for toggle
 * @param {string} toggledBy - User ID
 * @param {Object} pool - Database connection pool
 */
async function notifyAdmins(enable, reason, toggledBy, pool) {
  const client = await pool.connect();
  
  try {
    // Get all admin users (SuperAdmin, InstituteAdmin)
    const result = await client.query(
      `SELECT DISTINCT u.user_id, u.email, u.first_name, u.last_name
       FROM users u
       JOIN user_roles ur ON u.user_id = ur.user_id
       JOIN roles r ON ur.role_id = r.role_id
       WHERE r.role_name IN ('SuperAdmin', 'InstituteAdmin')
       AND u.is_active = true`
    );
    
    const admins = result.rows;
    
    if (admins.length === 0) {
      console.log('No admins found to notify');
      return;
    }
    
    // Create notification message
    const action = enable ? 'enabled' : 'disabled';
    const title = `AI Services ${action.charAt(0).toUpperCase() + action.slice(1)}`;
    const message = enable
      ? `AI services have been re-enabled by ${toggledBy}. Reason: ${reason}`
      : `⚠️ CRITICAL: AI services have been disabled by ${toggledBy}. The system has reverted to deterministic logic only. Reason: ${reason}`;
    
    // Insert notifications for all admins
    for (const admin of admins) {
      await client.query(
        `INSERT INTO notifications (
          user_id,
          title,
          message,
          type,
          priority,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          admin.user_id,
          title,
          message,
          'AI_GOVERNANCE',
          enable ? 'medium' : 'critical',
          JSON.stringify({
            kill_switch_event: true,
            enabled: enable,
            reason,
            toggled_by: toggledBy
          })
        ]
      );
    }
    
    console.log(`Notified ${admins.length} admins about kill switch ${action}`);
    
    // TODO: Send email notifications for critical events (when disabled)
    if (!enable) {
      console.log('TODO: Send email alerts to admins about AI service disruption');
    }
  } catch (error) {
    console.error('Error notifying admins:', error);
    // Don't throw - notification failure shouldn't prevent toggle
  } finally {
    client.release();
  }
}

/**
 * Check if AI services are enabled
 * Middleware helper function
 * 
 * @returns {Promise<boolean>} True if AI is enabled
 */
async function isAIEnabled() {
  try {
    const status = await getKillSwitchStatus();
    return status.enabled;
  } catch (error) {
    console.error('Error checking AI status:', error);
    // Default to enabled on error
    return true;
  }
}

/**
 * Middleware to check AI Kill Switch before AI operations
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
async function checkAIKillSwitch(req, res, next) {
  try {
    const status = await getKillSwitchStatus();
    
    if (!status.enabled) {
      return res.status(503).json({
        error: 'AI services are currently disabled',
        disabled_at: status.disabled_at,
        disabled_by: status.disabled_by,
        reason: status.reason,
        fallback: 'System has reverted to deterministic logic only'
      });
    }
    
    next();
  } catch (error) {
    console.error('Error in AI kill switch middleware:', error);
    // Allow request to proceed on error
    next();
  }
}

module.exports = {
  getKillSwitchStatus,
  toggleKillSwitch,
  isAIEnabled,
  checkAIKillSwitch,
  logKillSwitchEvent,
  notifyAdmins
};
