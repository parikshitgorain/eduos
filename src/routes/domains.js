/**
 * Domain Management Routes
 * 
 * API endpoints for managing custom domains and subdomains
 * Task: 1.2.1 - Build custom domain mapping middleware
 */

const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { invalidateCache } = require('../services/domainCacheService');
const crypto = require('crypto');

/**
 * GET /api/v1/domains
 * List all domains for the current tenant
 */
router.get('/', async (req, res) => {
  const result = await req.dbClient.query(
    `SELECT 
      domain_id,
      domain,
      domain_type,
      is_verified,
      verification_token,
      verified_at,
      ssl_status,
      ssl_issued_at,
      ssl_expires_at,
      is_active,
      created_at,
      updated_at
    FROM tenant_domains
    WHERE tenant_id = $1
    ORDER BY created_at DESC`,
    [req.tenant.id]
  );
  
  res.json({
    tenant_id: req.tenant.id,
    domains: result.rows,
    count: result.rowCount
  });
});

/**
 * GET /api/v1/domains/:domainId
 * Get details of a specific domain
 */
router.get('/:domainId', async (req, res) => {
  const { domainId } = req.params;
  
  const result = await req.dbClient.query(
    `SELECT 
      domain_id,
      domain,
      domain_type,
      is_verified,
      verification_token,
      verified_at,
      ssl_status,
      ssl_issued_at,
      ssl_expires_at,
      is_active,
      created_at,
      updated_at,
      metadata
    FROM tenant_domains
    WHERE domain_id = $1 AND tenant_id = $2`,
    [domainId, req.tenant.id]
  );
  
  if (result.rowCount === 0) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Domain not found'
    });
  }
  
  res.json({
    tenant_id: req.tenant.id,
    domain: result.rows[0]
  });
});

/**
 * POST /api/v1/domains
 * Add a new custom domain
 */
router.post('/', async (req, res) => {
  const { domain } = req.body;
  
  // Validate required fields
  if (!domain) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required field: domain'
    });
  }
  
  // Normalize domain (lowercase, remove protocol, trailing slash)
  const normalizedDomain = domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .split('/')[0]; // Take only the domain part
  
  // Validate domain format
  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
  if (!domainRegex.test(normalizedDomain)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid domain format'
    });
  }
  
  // Prevent adding .eduos.com subdomains (these are managed automatically)
  if (normalizedDomain.endsWith('.eduos.com')) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Cannot add .eduos.com subdomains. These are managed automatically.'
    });
  }
  
  // Generate verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  try {
    const result = await req.dbClient.query(
      `INSERT INTO tenant_domains (
        tenant_id,
        domain,
        domain_type,
        is_verified,
        verification_token,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING 
        domain_id,
        domain,
        domain_type,
        is_verified,
        verification_token,
        created_at`,
      [req.tenant.id, normalizedDomain, 'custom', false, verificationToken, true]
    );
    
    res.status(201).json({
      tenant_id: req.tenant.id,
      domain: result.rows[0],
      verification_instructions: {
        step1: 'Add a TXT record to your DNS configuration',
        record_type: 'TXT',
        record_name: '_eduos-verification',
        record_value: verificationToken,
        step2: 'Wait for DNS propagation (usually 5-30 minutes)',
        step3: 'Call POST /api/v1/domains/:domainId/verify to verify'
      }
    });
    
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Domain already exists'
      });
    }
    throw error;
  }
});

/**
 * POST /api/v1/domains/:domainId/verify
 * Verify domain ownership via DNS TXT record
 */
router.post('/:domainId/verify', async (req, res) => {
  const { domainId } = req.params;
  
  // Get domain details
  const domainResult = await req.dbClient.query(
    `SELECT domain_id, domain, verification_token, is_verified
     FROM tenant_domains
     WHERE domain_id = $1 AND tenant_id = $2`,
    [domainId, req.tenant.id]
  );
  
  if (domainResult.rowCount === 0) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Domain not found'
    });
  }
  
  const domainRecord = domainResult.rows[0];
  
  if (domainRecord.is_verified) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Domain is already verified'
    });
  }
  
  // In a real implementation, we would:
  // 1. Query DNS for TXT record: _eduos-verification.{domain}
  // 2. Compare the value with verification_token
  // 3. Update is_verified if match
  
  // For now, we'll simulate verification (in production, use dns.promises.resolveTxt)
  const dns = require('dns').promises;
  
  try {
    // Look up TXT records for _eduos-verification subdomain
    const txtRecords = await dns.resolveTxt(`_eduos-verification.${domainRecord.domain}`);
    
    // Flatten array of arrays and check for verification token
    const allRecords = txtRecords.flat();
    const isVerified = allRecords.includes(domainRecord.verification_token);
    
    if (!isVerified) {
      return res.status(400).json({
        error: 'Verification Failed',
        message: 'DNS TXT record not found or does not match verification token',
        expected_record: {
          name: `_eduos-verification.${domainRecord.domain}`,
          type: 'TXT',
          value: domainRecord.verification_token
        },
        found_records: allRecords
      });
    }
    
    // Update domain as verified
    await req.dbClient.query(
      `UPDATE tenant_domains
       SET is_verified = TRUE,
           verified_at = NOW()
       WHERE domain_id = $1`,
      [domainId]
    );
    
    // Invalidate cache for this domain
    invalidateCache(domainRecord.domain);
    
    res.json({
      message: 'Domain verified successfully',
      domain: domainRecord.domain,
      verified_at: new Date().toISOString()
    });
    
  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
      return res.status(400).json({
        error: 'Verification Failed',
        message: 'DNS TXT record not found. Please ensure the record is added and DNS has propagated.',
        expected_record: {
          name: `_eduos-verification.${domainRecord.domain}`,
          type: 'TXT',
          value: domainRecord.verification_token
        }
      });
    }
    throw error;
  }
});

/**
 * DELETE /api/v1/domains/:domainId
 * Remove a custom domain
 */
router.delete('/:domainId', async (req, res) => {
  const { domainId } = req.params;
  
  // Get domain details before deletion
  const domainResult = await req.dbClient.query(
    `SELECT domain, domain_type
     FROM tenant_domains
     WHERE domain_id = $1 AND tenant_id = $2`,
    [domainId, req.tenant.id]
  );
  
  if (domainResult.rowCount === 0) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Domain not found'
    });
  }
  
  const domainRecord = domainResult.rows[0];
  
  // Prevent deletion of default subdomain
  if (domainRecord.domain_type === 'subdomain') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Cannot delete default subdomain'
    });
  }
  
  // Delete domain
  await req.dbClient.query(
    `DELETE FROM tenant_domains
     WHERE domain_id = $1 AND tenant_id = $2`,
    [domainId, req.tenant.id]
  );
  
  // Invalidate cache
  invalidateCache(domainRecord.domain);
  
  res.json({
    message: 'Domain deleted successfully',
    domain: domainRecord.domain
  });
});

/**
 * GET /api/v1/domains/cache/stats
 * Get cache statistics (admin only)
 */
router.get('/cache/stats', async (req, res) => {
  const { getCacheStats } = require('../services/domainCacheService');
  const stats = await getCacheStats();
  
  res.json({
    cache_stats: stats,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/v1/domains/cache/clear
 * Clear domain cache (admin only)
 */
router.post('/cache/clear', async (req, res) => {
  const { clearCache } = require('../services/domainCacheService');
  const entriesCleared = await clearCache();
  
  res.json({
    message: 'Domain cache cleared successfully',
    entries_cleared: entriesCleared,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/v1/domains/:domainId/provision-ssl
 * Manually trigger SSL certificate provisioning
 */
router.post('/:domainId/provision-ssl', async (req, res) => {
  const { domainId } = req.params;
  const { provisionSSLCertificate } = require('../services/domainVerificationService');
  
  try {
    const result = await provisionSSLCertificate(domainId);
    
    if (!result.success) {
      return res.status(400).json({
        error: 'SSL Provisioning Failed',
        message: result.reason
      });
    }
    
    res.json({
      message: 'SSL certificate provisioned successfully',
      domain: result.domain,
      ssl_status: result.sslStatus,
      issued_at: result.issuedAt,
      expires_at: result.expiresAt
    });
    
  } catch (error) {
    console.error('Error provisioning SSL:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to provision SSL certificate'
    });
  }
});

/**
 * GET /api/v1/domains/jobs/status
 * Get background job status (admin only)
 */
router.get('/jobs/status', async (req, res) => {
  const { getJobStatus } = require('../jobs/domainVerificationJob');
  const status = getJobStatus();
  
  res.json({
    job_status: status,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/v1/domains/jobs/trigger
 * Manually trigger background job (admin only)
 */
router.post('/jobs/trigger', async (req, res) => {
  const { triggerJob } = require('../jobs/domainVerificationJob');
  
  try {
    const result = await triggerJob();
    
    res.json({
      message: 'Background job triggered successfully',
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error triggering job:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to trigger background job'
    });
  }
});

module.exports = router;
