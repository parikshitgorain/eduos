/**
 * Cache Management API Routes
 * 
 * Task: 1.2.3 - Create tenant routing cache layer
 * 
 * Provides endpoints for:
 * - Cache statistics and monitoring
 * - Cache invalidation
 * - Cache warmup
 */

const express = require('express');
const router = express.Router();
const {
  getCacheStats,
  resetCacheStats,
  clearCache,
  invalidateCache,
  invalidateTenantCache,
  warmupCache
} = require('../services/domainCacheService');
const { query } = require('../config/database');

/**
 * GET /api/v1/cache/stats
 * 
 * Get cache statistics including hit rate
 * 
 * Response:
 * {
 *   totalEntries: number,
 *   hits: number,
 *   misses: number,
 *   total: number,
 *   hitRate: number (percentage),
 *   cacheTTL: number (seconds),
 *   memoryUsed: string,
 *   timestamp: string
 * }
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getCacheStats();
    
    // Check if hit rate meets SLA (> 95%)
    const meetsHitRateSLA = stats.hitRate >= 95;
    
    res.json({
      ...stats,
      meetsHitRateSLA,
      slaThreshold: 95
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve cache statistics'
    });
  }
});

/**
 * POST /api/v1/cache/invalidate
 * 
 * Invalidate cache for a specific domain
 * 
 * Request body:
 * {
 *   domain: string (required)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   domain: string,
 *   message: string
 * }
 */
router.post('/invalidate', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Domain is required'
      });
    }
    
    const success = await invalidateCache(domain);
    
    res.json({
      success,
      domain,
      message: success 
        ? `Cache invalidated for domain: ${domain}`
        : `No cache entry found for domain: ${domain}`
    });
  } catch (error) {
    console.error('Error invalidating cache:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to invalidate cache'
    });
  }
});

/**
 * POST /api/v1/cache/invalidate-tenant
 * 
 * Invalidate cache for all domains of a tenant
 * 
 * Request body:
 * {
 *   tenantId: string (required)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   tenantId: string,
 *   domainsInvalidated: number,
 *   message: string
 * }
 */
router.post('/invalidate-tenant', async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant ID is required'
      });
    }
    
    const domainsInvalidated = await invalidateTenantCache(tenantId);
    
    res.json({
      success: true,
      tenantId,
      domainsInvalidated,
      message: `Invalidated ${domainsInvalidated} domain(s) for tenant: ${tenantId}`
    });
  } catch (error) {
    console.error('Error invalidating tenant cache:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to invalidate tenant cache'
    });
  }
});

/**
 * POST /api/v1/cache/clear
 * 
 * Clear entire domain cache
 * 
 * Response:
 * {
 *   success: boolean,
 *   entriesCleared: number,
 *   message: string
 * }
 */
router.post('/clear', async (req, res) => {
  try {
    const entriesCleared = await clearCache();
    
    res.json({
      success: true,
      entriesCleared,
      message: `Cleared ${entriesCleared} cache entries`
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to clear cache'
    });
  }
});

/**
 * POST /api/v1/cache/reset-stats
 * 
 * Reset cache statistics (hits/misses counters)
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string
 * }
 */
router.post('/reset-stats', async (req, res) => {
  try {
    await resetCacheStats();
    
    res.json({
      success: true,
      message: 'Cache statistics reset successfully'
    });
  } catch (error) {
    console.error('Error resetting cache stats:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to reset cache statistics'
    });
  }
});

/**
 * POST /api/v1/cache/warmup
 * 
 * Warm up cache with all active domains
 * 
 * Response:
 * {
 *   success: boolean,
 *   domainsCached: number,
 *   message: string
 * }
 */
router.post('/warmup', async (req, res) => {
  try {
    // Fetch all active domains from database
    const result = await query(`
      SELECT 
        COALESCE(td.domain, t.subdomain || '.eduos.com') as domain,
        t.tenant_id,
        t.name as tenant_name,
        t.tier as tenant_tier,
        t.status as tenant_status,
        COALESCE(td.domain_type, 'subdomain') as domain_type,
        COALESCE(td.is_verified, true) as is_verified
      FROM tenants t
      LEFT JOIN tenant_domains td ON t.tenant_id = td.tenant_id AND td.is_active = true
      WHERE t.status = 'active'
    `);
    
    // Prepare domains for warmup
    const domains = result.rows.map(row => ({
      domain: row.domain,
      tenantInfo: {
        tenant_id: row.tenant_id,
        tenant_name: row.tenant_name,
        tenant_tier: row.tenant_tier,
        tenant_status: row.tenant_status,
        domain_type: row.domain_type,
        is_verified: row.is_verified
      }
    }));
    
    // Warm up cache
    const domainsCached = await warmupCache(domains);
    
    res.json({
      success: true,
      domainsCached,
      message: `Cache warmed up with ${domainsCached} domains`
    });
  } catch (error) {
    console.error('Error warming up cache:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to warm up cache'
    });
  }
});

module.exports = router;
