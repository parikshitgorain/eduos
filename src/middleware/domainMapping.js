/**
 * Domain Mapping Middleware
 * 
 * Resolves custom domains and subdomains to tenant_id for multi-tenant routing.
 * 
 * Task: 1.2.1 - Build custom domain mapping middleware
 * Task: 1.2.3 - Create tenant routing cache layer (Redis-based)
 * 
 * Definition of Done:
 * - Middleware resolves school.custom-domain.com to tenant_id
 * - Domain-to-tenant mapping stored in tenant_domains table
 * - Support for both subdomain and custom domain routing
 * - 404 error page for unmapped domains
 * - Load testing: handles 1000 req/sec with < 10ms latency
 * - Redis cache stores domain → tenant_id mappings
 * - Cache TTL: 5 minutes with automatic refresh
 * - Cache invalidation on domain configuration changes
 * - Fallback to database query if cache miss
 * - Monitoring: cache hit rate > 95%
 */

const { query } = require('../config/database');
const {
  getCachedTenant,
  cacheTenant,
  invalidateCache,
  invalidateTenantCache,
  clearCache,
  getCacheStats
} = require('../services/domainCacheService');


/**
 * Extract domain from request
 * Supports:
 * - Host header: school.eduos.com
 * - X-Forwarded-Host header (for proxies): custom-domain.com
 * 
 * @param {Request} req - Express request object
 * @returns {string} - Normalized domain (lowercase)
 */
function extractDomain(req) {
  // Check X-Forwarded-Host first (for reverse proxies)
  const forwardedHost = req.headers['x-forwarded-host'];
  if (forwardedHost) {
    return forwardedHost.toLowerCase().split(':')[0]; // Remove port if present
  }
  
  // Fallback to Host header
  const host = req.headers.host;
  if (host) {
    return host.toLowerCase().split(':')[0]; // Remove port if present
  }
  
  return null;
}

/**
 * Resolve domain to tenant using database
 * 
 * @param {string} domain - Domain to resolve
 * @returns {Promise<Object|null>} - Tenant information or null
 */
async function resolveDomainToTenant(domain) {
  try {
    const result = await query(
      'SELECT * FROM resolve_domain_to_tenant($1)',
      [domain]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error resolving domain to tenant:', error);
    throw error;
  }
}

/**
 * Domain Mapping Middleware
 * 
 * This middleware:
 * 1. Extracts domain from request headers
 * 2. Checks Redis cache for domain-to-tenant mapping
 * 3. If cache miss, queries database
 * 4. Caches result in Redis for future requests
 * 5. Attaches tenant info to request object
 * 6. Returns 404 for unmapped domains
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function domainMapping(req, res, next) {
  const startTime = Date.now();
  
  try {
    // Extract domain from request
    const domain = extractDomain(req);
    
    if (!domain) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing Host header'
      });
    }
    
    // Check Redis cache first
    let tenantInfo = await getCachedTenant(domain);
    let cacheHit = true;
    
    if (!tenantInfo) {
      // Cache miss - query database
      cacheHit = false;
      tenantInfo = await resolveDomainToTenant(domain);
      
      if (!tenantInfo) {
        // Domain not found - return 404
        const fs = require('fs');
        const path = require('path');
        
        try {
          const htmlPath = path.join(__dirname, '../views/404-domain.html');
          let html = fs.readFileSync(htmlPath, 'utf8');
          html = html.replace('{{domain}}', domain);
          
          return res.status(404).type('html').send(html);
        } catch (err) {
          // Fallback to JSON if HTML file not found
          return res.status(404).json({
            error: 'Not Found',
            message: 'This domain is not registered with EduOS Platform',
            domain: domain
          });
        }
      }
      
      // Cache the result in Redis
      await cacheTenant(domain, tenantInfo);
    }
    
    // Check if tenant is active
    if (tenantInfo.tenant_status !== 'active') {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Tenant is ${tenantInfo.tenant_status}. Please contact support.`
      });
    }
    
    // Check if custom domain is verified
    if (tenantInfo.domain_type === 'custom' && !tenantInfo.is_verified) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Custom domain is not verified. Please complete domain verification.'
      });
    }
    
    // Attach domain info to request
    req.domain = {
      name: domain,
      type: tenantInfo.domain_type,
      isVerified: tenantInfo.is_verified,
      tenantId: tenantInfo.tenant_id,
      tenantName: tenantInfo.tenant_name,
      tenantTier: tenantInfo.tenant_tier,
      cacheHit: cacheHit
    };
    
    // Calculate middleware overhead
    const overhead = Date.now() - startTime;
    req.domainMappingOverhead = overhead;
    
    // Log performance warning if overhead exceeds 10ms
    if (overhead > 10) {
      console.warn('Domain mapping middleware overhead exceeded 10ms:', {
        overhead: `${overhead}ms`,
        domain: domain,
        tenant_id: tenantInfo.tenant_id,
        cache_hit: cacheHit
      });
    }
    
    next();
    
  } catch (error) {
    console.error('Domain mapping middleware error:', error);
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to resolve domain'
    });
  }
}

/**
 * Optional middleware to require verified custom domains
 * Use this for sensitive operations that should only work on verified domains
 */
function requireVerifiedDomain(req, res, next) {
  if (!req.domain) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Domain mapping middleware not applied'
    });
  }
  
  if (req.domain.type === 'custom' && !req.domain.isVerified) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'This operation requires a verified custom domain'
    });
  }
  
  next();
}

module.exports = {
  domainMapping,
  requireVerifiedDomain,
  extractDomain,
  invalidateCache,
  invalidateTenantCache,
  clearCache,
  getCacheStats,
  resolveDomainToTenant
};
