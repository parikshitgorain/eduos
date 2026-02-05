/**
 * Tenant Routes
 * 
 * API endpoints for tenant provisioning and management.
 * 
 * Task: 1.1.3 - Create tenant provisioning API
 */

const express = require('express');
const router = express.Router();
const tenantService = require('../services/tenantService');
const { getClient } = require('../config/database');

/**
 * POST /api/v1/tenants
 * Create a new tenant
 * 
 * Request body:
 * {
 *   "name": "Example School",
 *   "subdomain": "example-school",
 *   "tier": "Basic|Business|Enterprise",
 *   "metadata": {} // optional
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { name, subdomain, tier, metadata } = req.body;
    
    // Create tenant
    const result = await tenantService.createTenant({
      name,
      subdomain,
      tier,
      metadata
    });
    
    res.status(201).json({
      success: true,
      message: 'Tenant created successfully',
      data: {
        tenant: result.tenant,
        quotas: result.quotas
      }
    });
    
  } catch (error) {
    console.error('Error creating tenant:', error);
    
    // Handle duplicate subdomain error
    if (error.code === '23505' && error.constraint === 'tenants_subdomain_key') {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Subdomain already exists'
      });
    }
    
    // Handle validation errors
    if (error.message.startsWith('Validation failed:')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create tenant'
    });
  }
});

/**
 * GET /api/v1/tenants/:tenantId
 * Get tenant by ID
 */
router.get('/:tenantId', async (req, res) => {
  const client = await getClient();
  
  try {
    const { tenantId } = req.params;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid tenant ID format'
      });
    }
    
    const tenant = await tenantService.getTenantById(tenantId, client);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Tenant not found'
      });
    }
    
    res.json({
      success: true,
      data: tenant
    });
    
  } catch (error) {
    console.error('Error fetching tenant:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch tenant'
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/v1/tenants
 * List all tenants with pagination
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - status: Filter by status (optional)
 * - tier: Filter by tier (optional)
 */
router.get('/', async (req, res) => {
  const client = await getClient();
  
  try {
    const { page, limit, status, tier } = req.query;
    
    const options = {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      status,
      tier
    };
    
    // Validate limit
    if (options.limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Limit cannot exceed 100'
      });
    }
    
    const result = await tenantService.listTenants(options, client);
    
    res.json({
      success: true,
      data: result.tenants,
      pagination: result.pagination
    });
    
  } catch (error) {
    console.error('Error listing tenants:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to list tenants'
    });
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/v1/tenants/:tenantId
 * Update tenant
 * 
 * Request body:
 * {
 *   "name": "Updated Name", // optional
 *   "tier": "Business", // optional
 *   "status": "suspended", // optional
 *   "metadata": {} // optional
 * }
 */
router.patch('/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid tenant ID format'
      });
    }
    
    const updates = req.body;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No fields to update'
      });
    }
    
    const tenant = await tenantService.updateTenant(tenantId, updates);
    
    res.json({
      success: true,
      message: 'Tenant updated successfully',
      data: tenant
    });
    
  } catch (error) {
    console.error('Error updating tenant:', error);
    
    if (error.message === 'Tenant not found') {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Tenant not found'
      });
    }
    
    if (error.message === 'No valid fields to update') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update tenant'
    });
  }
});

/**
 * GET /api/v1/tenants/subdomain/:subdomain
 * Get tenant by subdomain
 */
router.get('/subdomain/:subdomain', async (req, res) => {
  const client = await getClient();
  
  try {
    const { subdomain } = req.params;
    
    const tenant = await tenantService.getTenantBySubdomain(subdomain, client);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Tenant not found'
      });
    }
    
    res.json({
      success: true,
      data: tenant
    });
    
  } catch (error) {
    console.error('Error fetching tenant by subdomain:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch tenant'
    });
  } finally {
    client.release();
  }
});

module.exports = router;
