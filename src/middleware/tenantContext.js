/**
 * Tenant Context Middleware
 * 
 * Extracts tenant_id from JWT token and sets PostgreSQL session variable
 * to enable Row-Level Security (RLS) enforcement.
 * 
 * Task: 1.1.2 - Implement tenant context middleware
 * 
 * Definition of Done:
 * - Middleware extracts tenant_id from JWT token or session
 * - All database queries automatically include tenant_id filter
 * - API endpoints return 403 Forbidden for cross-tenant access attempts
 * - Unit tests cover tenant isolation scenarios
 * - Performance benchmark: < 5ms overhead per request
 */

const jwt = require('jsonwebtoken');
const { getClient } = require('../config/database');

/**
 * Tenant Context Middleware
 * 
 * This middleware:
 * 1. Extracts JWT token from Authorization header
 * 2. Verifies and decodes the token
 * 3. Extracts tenant_id from token payload
 * 4. Sets PostgreSQL session variable for RLS
 * 5. Attaches tenant context to request object
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function tenantContext(req, res, next) {
  const startTime = Date.now();
  
  try {
    // Extract JWT token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing Authorization header'
      });
    }
    
    // Validate Bearer token format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid Authorization header format. Expected: Bearer <token>'
      });
    }
    
    const token = parts[1];
    
    // Verify and decode JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Token has expired'
        });
      }
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid token'
        });
      }
      throw jwtError;
    }
    
    // Extract tenant_id from token payload
    const tenantId = decoded.tenant_id;
    
    if (!tenantId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Token does not contain tenant_id'
      });
    }
    
    // Validate tenant_id format (UUID v4)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid tenant_id format'
      });
    }
    
    // Get database client from pool
    const client = await getClient();
    
    try {
      // Set PostgreSQL session variable for RLS
      // This enables automatic tenant filtering on all queries
      await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);
      
      // Attach tenant context to request object
      req.tenant = {
        id: tenantId,
        user_id: decoded.user_id,
        roles: decoded.roles || [],
        permissions: decoded.permissions || []
      };
      
      // Attach database client to request for this transaction
      req.dbClient = client;
      
      // Calculate middleware overhead
      const overhead = Date.now() - startTime;
      
      // Log performance warning if overhead exceeds 5ms
      if (overhead > 5) {
        console.warn('Tenant context middleware overhead exceeded 5ms:', {
          overhead: `${overhead}ms`,
          tenant_id: tenantId,
          path: req.path
        });
      }
      
      // Attach overhead to request for monitoring
      req.tenantContextOverhead = overhead;
      
      // Ensure client is released after response
      res.on('finish', () => {
        if (req.dbClient) {
          req.dbClient.release();
        }
      });
      
      // Handle errors and release client
      res.on('error', () => {
        if (req.dbClient) {
          req.dbClient.release();
        }
      });
      
      next();
      
    } catch (dbError) {
      // Release client on database error
      client.release();
      throw dbError;
    }
    
  } catch (error) {
    console.error('Tenant context middleware error:', error);
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to establish tenant context'
    });
  }
}

/**
 * Validate Cross-Tenant Access
 * 
 * Additional middleware to explicitly check if a resource belongs to the current tenant.
 * Use this for extra security on sensitive operations.
 * 
 * @param {string} resourceTenantId - Tenant ID of the resource being accessed
 * @param {string} currentTenantId - Current tenant ID from request context
 * @returns {boolean} - True if access is allowed
 */
function validateTenantAccess(resourceTenantId, currentTenantId) {
  return resourceTenantId === currentTenantId;
}

/**
 * Cross-Tenant Access Guard Middleware
 * 
 * Use this middleware after tenantContext to add an extra layer of validation.
 * Returns 403 if attempting to access resources from another tenant.
 * 
 * @param {Function} getTenantIdFromResource - Function to extract tenant_id from resource
 */
function crossTenantGuard(getTenantIdFromResource) {
  return async (req, res, next) => {
    try {
      const resourceTenantId = await getTenantIdFromResource(req);
      
      if (!resourceTenantId) {
        // Resource doesn't have tenant_id, skip validation
        return next();
      }
      
      if (!validateTenantAccess(resourceTenantId, req.tenant.id)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Cross-tenant access denied'
        });
      }
      
      next();
    } catch (error) {
      console.error('Cross-tenant guard error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to validate tenant access'
      });
    }
  };
}

module.exports = {
  tenantContext,
  validateTenantAccess,
  crossTenantGuard
};
