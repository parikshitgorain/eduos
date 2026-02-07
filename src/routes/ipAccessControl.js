/**
 * IP Access Control Routes
 * 
 * Task: 4.3.1 - Implement rate limiting and DDoS protection
 * 
 * Provides API endpoints for managing IP blacklist and whitelist
 */

const express = require('express');
const { ipAccessControl } = require('../middleware/rateLimiter');
const router = express.Router();

/**
 * Get blacklisted IPs
 * GET /api/v1/ip-access-control/blacklist
 */
router.get('/blacklist', async (req, res) => {
  try {
    const blacklist = await ipAccessControl.getBlacklist();
    res.json({
      success: true,
      count: blacklist.length,
      ips: blacklist
    });
  } catch (error) {
    console.error('Get blacklist error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve blacklist'
    });
  }
});

/**
 * Get whitelisted IPs
 * GET /api/v1/ip-access-control/whitelist
 */
router.get('/whitelist', async (req, res) => {
  try {
    const whitelist = await ipAccessControl.getWhitelist();
    res.json({
      success: true,
      count: whitelist.length,
      ips: whitelist
    });
  } catch (error) {
    console.error('Get whitelist error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve whitelist'
    });
  }
});

/**
 * Add IP to blacklist
 * POST /api/v1/ip-access-control/blacklist
 * Body: { ip: string, ttl?: number }
 */
router.post('/blacklist', async (req, res) => {
  try {
    const { ip, ttl } = req.body;
    
    if (!ip) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'IP address is required'
      });
    }
    
    // Validate IP format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid IP address format'
      });
    }
    
    await ipAccessControl.addToBlacklist(ip, ttl);
    
    res.status(201).json({
      success: true,
      message: `IP ${ip} added to blacklist`,
      ip,
      ttl: ttl || null
    });
  } catch (error) {
    console.error('Add to blacklist error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to add IP to blacklist'
    });
  }
});

/**
 * Remove IP from blacklist
 * DELETE /api/v1/ip-access-control/blacklist/:ip
 */
router.delete('/blacklist/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    
    await ipAccessControl.removeFromBlacklist(ip);
    
    res.json({
      success: true,
      message: `IP ${ip} removed from blacklist`,
      ip
    });
  } catch (error) {
    console.error('Remove from blacklist error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to remove IP from blacklist'
    });
  }
});

/**
 * Add IP to whitelist
 * POST /api/v1/ip-access-control/whitelist
 * Body: { ip: string }
 */
router.post('/whitelist', async (req, res) => {
  try {
    const { ip } = req.body;
    
    if (!ip) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'IP address is required'
      });
    }
    
    // Validate IP format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid IP address format'
      });
    }
    
    await ipAccessControl.addToWhitelist(ip);
    
    res.status(201).json({
      success: true,
      message: `IP ${ip} added to whitelist`,
      ip
    });
  } catch (error) {
    console.error('Add to whitelist error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to add IP to whitelist'
    });
  }
});

/**
 * Remove IP from whitelist
 * DELETE /api/v1/ip-access-control/whitelist/:ip
 */
router.delete('/whitelist/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    
    await ipAccessControl.removeFromWhitelist(ip);
    
    res.json({
      success: true,
      message: `IP ${ip} removed from whitelist`,
      ip
    });
  } catch (error) {
    console.error('Remove from whitelist error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to remove IP from whitelist'
    });
  }
});

/**
 * Check IP status
 * GET /api/v1/ip-access-control/check/:ip
 */
router.get('/check/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    
    const isBlacklisted = await ipAccessControl.isBlacklisted(ip);
    const isWhitelisted = await ipAccessControl.isWhitelisted(ip);
    
    res.json({
      success: true,
      ip,
      blacklisted: isBlacklisted,
      whitelisted: isWhitelisted,
      status: isBlacklisted ? 'blocked' : isWhitelisted ? 'allowed' : 'normal'
    });
  } catch (error) {
    console.error('Check IP error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to check IP status'
    });
  }
});

module.exports = router;
